const express = require('express');
const { checkAuthenticated, checkIsMe } = require('../middleware/auth');
const router = express.Router({
    mergeParams: true
});
const Post = require('../models/posts.model');
const User = require('../models/users.model');
const multer = require('multer');
const { storage, cloudinary } = require("../cloudinary/index");
const upload = multer({ storage }).array('image')

router.get('/', checkAuthenticated, async (req, res) => {
    try {
        const posts = await Post.find({ "author.id": req.params.id }).populate('comments').sort({ createdAt: -1 }).exec();
        const user = await User.findById(req.params.id).exec();

        if (!user) {
            req.flash('error', '없는 유저 입니다.');
            return res.redirect('back');
        }

        res.render('profile', {
            posts: posts,
            user: user
        });
    } catch (err) {
        req.flash('error', '데이터를 가져오는데 실패했습니다.');
        res.redirect('back');
    }
});


router.get('/edit', checkIsMe, (req, res) => {
    res.render('profile/edit', {
        user: req.user
    })
})

router.put('/', checkIsMe, upload, async (req, res) => {
    // roadAddress에서 hometown 추출
    let hometown;
    let image = req.files.map(f => ({ url: f.path, filename: f.filename }));

    if (req.body.roadAddress) {
        hometown = req.body.roadAddress.split(' ')[0];
    } else {
        hometown = "데이터 없음";
    }

    if (req.body.image) {
        image = req.body.image[0];
    }

    // req.body에 hometown 추가
    req.body.hometown = hometown;
    req.body.image = image;

    User.findByIdAndUpdate(req.params.id, req.body, (err, user) => {
        if (err || !user) {
            req.flash('error', '유저 데이터를 업데이트하는데 에러가 났습니다.');
            res.redirect('back');
        } else {
            req.flash('success', '유저 데이터를 업데이트하는데 성공했습니다.');
            res.redirect('/profile/' + req.params.id);
        }
    })
})


module.exports = router;