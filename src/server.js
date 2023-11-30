if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}

const cookieSession = require('cookie-session');
const express = require('express');
const { default: mongoose } = require('mongoose');
const passport = require('passport');
const app = express();
const path = require('path');
const flash = require('connect-flash');
const methodOverride = require('method-override');

const config = require('config');
const mainRouter = require('./routes/main.router');
const usersRouter = require('./routes/users.router');
const postsRouter = require('./routes/posts.router');
const commentsRouter = require('./routes/comments.router');
const resellsRouter = require('./routes/resells.router');
const resellcommentsRouter = require('./routes/resellcomments.router');
const profileRouter = require('./routes/profile.router');
const likeRouter = require('./routes/likes.router');
const friendsRouter = require('./routes/friends.router');
const chatsRouter = require('./routes/chats.router');
const User = require('./models/users.model');

const { Server } = require("socket.io");
const { savedMessages, fetchMessages } = require('./utils/messages');
const http = require('http');
const server = http.createServer(app);
const io = new Server(server);

const serverConfig = config.get('server');

require('dotenv').config()
const port = process.env.PORT || serverConfig.port;

app.use(cookieSession({
    name: 'cookie-session-name',
    keys: [process.env.COOKIE_ENCRYPTION_KEY]
}))

// register regenerate & save after the cookieSession middleware initialization
app.use(function (request, response, next) {
    if (request.session && !request.session.regenerate) {
        request.session.regenerate = (cb) => {
            cb()
        }
    }
    if (request.session && !request.session.save) {
        request.session.save = (cb) => {
            cb()
        }
    }
    next()
})

app.use(passport.initialize());
app.use(passport.session());
require('./config/passport');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(flash());
app.use(methodOverride('_method'));
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('mongodb connected')
    })
    .catch((err) => {
        console.log(err);
    })

app.use(express.static(path.join(__dirname, 'public')));


app.get('/send', (req, res) => {
    req.flash('post success', '포스트가 생성되었습니다.');
    res.redirect('/receive')
})

app.get('/receive', (req, res) => {
    res.send(req.flash('post success')[0]);
})

app.use((req, res, next) => {
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    res.locals.currentUser = req.user;
    next();
})

// 채팅기능

app.post('/session', async (req, res) => {
    const username = req.body.username;

    try {
        // 데이터베이스에서 사용자를 찾습니다.
        const user = await User.findOne({ username: username });
        if (user) {
            // 사용자가 존재하면, 사용자의 chatId를 가져옵니다.
            res.send({
                username: user.username,
                userID: user.chatId
            });
        } else {
            // 사용자가 존재하지 않으면 적절한 메시지를 반환합니다.
            res.status(404).send({ error: 'User not found' });
        }
    } catch (error) {
        // 오류 처리
        console.error(error);
        res.status(500).send({ error: 'Internal server error' });
    }
});

io.use((socket, next) => {
    const username = socket.handshake.auth.username;
    const userID = socket.handshake.auth.userID;
    if (!username) {
        return next(new Error('Invalid username'));
    }

    socket.username = username;
    socket.id = userID;
    console.log(socket.username);
    console.log(socket.id);

    next();
})

let users = [];
io.on('connection', async socket => {

    let userData = {
        username: socket.username,
        userID: socket.id
    };
    users.push(userData);
    io.emit('users-data', { users })

    // 클라이언트에서 보내온 메시지  A ==> Server  ===> B
    socket.on('message-to-server', (payload) => {
        io.to(payload.to).emit('message-to-client', payload);
        savedMessages(payload);
    })

    // 데이터베이스에서 메시지 가져오기
    socket.on('fetch-messages', ({ receiver }) => {
        fetchMessages(io, socket.id, receiver);
    })

    // 유저가 방에서 나갔을 때 
    socket.on('disconnect', () => {
        users = users.filter(user => user.userID !== socket.id);
        // 사이드바 리스트에서 없애기
        io.emit('users-data', { users })
        // 대화 중이라면 대화창 없애기
        io.emit('user-away', socket.id);
    })
})

app.use('/', mainRouter);
app.use('/auth', usersRouter);
app.use('/posts', postsRouter);
app.use('/posts/:id/comments', commentsRouter);
app.use('/resells', resellsRouter);
app.use('/resells/id/comments', resellcommentsRouter);
app.use('/profile/:id', profileRouter);
app.use('/friends', friendsRouter);
app.use('/chats', chatsRouter);
app.use(likeRouter);

app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.send(err.message || "Error Occurred");
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}!`)
}).on('error', (err) => {
    console.error('Failed to start server:', err);
});