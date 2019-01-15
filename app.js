var express               = require("express"),
    mongoose              = require("mongoose"),
    passport              = require("passport"),
    localStrategy         = require("passport-local"),
    bodyParser            = require("body-parser"),
    User                  = require("./models/user"),
    multer                = require("multer"),
    GridFsStorage         = require("multer-gridfs-storage"),
    Grid                  = require("gridfs-stream"),
    path                  = require("path"),
    crypto                = require("crypto"),
    methodOverride        = require("method-override"),
    Chat                  = require("./models/chat"),
    Item                  = require("./models/item");

var mongoURI = 'mongodb://localhost/demo';
mongoose.connect(mongoURI);
var conn = mongoose.createConnection(mongoURI);
var app = express();

app.use(express.static('public'));
app.use(require("express-session")({
    secret: "This is my secret sentence",
    resave: false,
    saveUninitialized: false
}));
app.use(methodOverride('_method'));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:true}));
passport.use(new localStrategy(User.authenticate()));
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

var gfs;

conn.once('open', function(){
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('uploads');
});

var storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        var filename = buf.toString('hex') + path.extname(file.originalname);
        var fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});

var upload = multer({ storage });

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/login");
}

app.get('/image/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (err || !file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png' || file.contentType === 'image/jpg') {
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
});

app.get('/', function(req, res) {
    Item.find({}, function(err, items){
        if(err){
            console.log(err);
        } else {
            res.render('index', {currentUser: req.user, items: items});
        }
    });
});

app.get("/register", function(req, res) {
    res.render("register", {currentUser: req.user});
});

app.post("/register", function(req, res){
    User.register(new User({username: req.body.username, contact: req.body.contact, email: req.body.email}), req.body.password, function(err, user){
        if(err){
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/");
            });
        }
    });
});

app.get("/login", function(req, res) {
    res.render("login", {currentUser: req.user});
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login"
}), function(req, res){
});

app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
});

app.get('/profile', isLoggedIn, function(req, res) {
    var items = [];
    var count = 0;
    User.findOne({_id: req.user._id}, function(err, user){
        if(err){
            console.log(err);
        } else {
            if(user.files.length === 0){
                return res.render('profile', {currentUser: req.user, items: items});
            }
            user.files.forEach(function(file){
                Item.findOne({displayfilename: file}, function(err, item) {
                    count++;
                    if(err){
                        console.log(err);
                    } else {
                        items.push(item);
                        if(count === user.files.length){
                            res.render('profile', {currentUser: req.user, items: items});
                        }
                    }
                });
            });
        }
    });
});

app.get('/upload', isLoggedIn, function(req, res) {
    res.render('upload', {currentUser: req.user});
});

app.post('/upload', isLoggedIn, upload.single('file'), (req, res) => {
     var obj = {
         displayfilename: req.file.filename,
         originalfilename: req.file.originalname,
         itemname: req.body.itemname,
         description: req.body.description,
         price: req.body.price,
         seller: req.user.username
     };
     Item.create(obj, function(err, item){
         if(err){
             console.log(err);
         } else {
            User.findOne({_id: req.user._id}, function(err, user) {
                if(err){
                    console.log(err);
                } else {
                    user.files.push(req.file.filename);
                    user.save();
                    res.redirect('/profile');
                }
            });
         }
     });
 });
 
app.get('/delete/:filename', isLoggedIn, (req, res) => {
    Item.remove({displayfilename: req.params.filename}, function(err){
        if(err){
            console.log(err);
        } else {
            gfs.remove({filename: req.params.filename, root: 'uploads'}, function(err) {
            if(err){
                console.log(err);
            } else {
                User.findOne({_id: req.user._id}, function(err, user) {
                if(err){
                    console.log(err);
                } else {
                    var index;
                    user.files.forEach(function(file, i){
                        if(file === req.params.filename){
                            index = i;
                        }
                    });
                    user.files.splice(index, 1);
                    user.save();
                    res.redirect('/profile');
                }
            });
            }
        });
        }
    });
});

app.get('/edit/:filename', isLoggedIn, function(req, res) {
    Item.findOne({displayfilename: req.params.filename}, function(err, item) {
        if(err){
            console.log(err);
        } else {
            res.render('edit', {currentUser: req.user, item: item});
        }
    });
});

app.post('/edit/:filename', isLoggedIn, upload.single('file'), function(req, res) {
    if(!req.file){
        Item.findOne({displayfilename: req.params.filename}, function(err, item) {
            if(err){
                console.log(err);
            } else {
                item.itemname = req.body.itemname;
                item.description = req.body.description;
                item.price = req.body.price;
                item.save();
                res.redirect('/profile');
            }
        });
    } else {
        var obj = {
            displayfilename: req.file.filename,
            originalfilename: req.file.originalname,
            itemname: req.body.itemname,
            description: req.body.description,
            price: req.body.price,
            seller: req.user.username
        };
        Item.create(obj, function(err, item){
            if(err){
                console.log(err);
            } else {
                User.findOne({_id: req.user._id}, function(err, user) {
                    if(err){
                        console.log(err);
                    } else {
                        user.files.push(req.file.filename);
                        user.save();
                        res.redirect('/delete/' + req.params.filename);
                    }
                });
            }
        });
    }
});

app.get('/item/:filename', function(req, res) {
    Item.findOne({displayfilename: req.params.filename}, function(err, item){
        if(err){
            console.log(err);
        } else {
            User.findOne({username: item.seller}, function(err, seller) {
                if(err){
                    console.log(err);
                } else {
                    res.render('item', {currentUser: req.user, seller: seller, item: item});
                }
            });
        }
    });
});

app.post('/review/:filename', isLoggedIn, function(req, res){
    Item.findOne({displayfilename: req.params.filename}, function(err, item){
        if(err){
            console.log(err);
        } else {
            var obj = {
                username: req.user.username,
                review: req.body.review
            };
            item.reviews.push(obj);
            item.save();
            res.redirect('/item/'+ req.params.filename);
        }
    });
});

app.get('/chat/:username', function(req, res) {
    var index, blockedSend, blockedRecieve, flag = 0;
    User.findOne({username: req.user.username}, function(err, user) {
        if(err){
            console.log(err);
        } else {
            for(var i = 0; i < user.blockedSend.length; i++){
                if(user.blockedSend[i] === req.params.username){
                    flag = 1;
                    break;
                }
            }
            if(flag === 1){
                blockedSend = 1;
                flag = 0;
            } else {
                blockedSend = 0;
            }
            for(var i = 0; i < user.blockedRecieve.length; i++){
                if(user.blockedRecieve[i] === req.params.username){
                    flag = 1;
                    break;
                }
            }
            if(flag === 1){
                blockedRecieve = 1;
                flag = 0;
            } else {
                blockedRecieve = 0;
            }
            for(var i = 0; i < user.chats.length; i++){
                if(user.chats[i].username === req.params.username){
                    flag = 1;
                    index = i;
                    break;
                }
            }
            if(flag === 0){
                res.render('chat', {currentUser: req.user, chat: [], username: req.params.username, blockedSend: blockedSend, blockedRecieve: blockedRecieve});
            } else {
                var user1, user2;
                if(req.user.chats[index].user1){
                    user1 = req.user.username;
                    user2 = req.params.username;
                } else {
                    user1 = req.params.username;
                    user2 = req.user.username;
                }
                Chat.findOne({user1: user1, user2: user2}, function(err, chat){
                    if(err){
                        console.log(err);
                    } else {
                        user.chats[index].unreadMessages = 0;
                        user.save();
                        res.render('chat', {currentUser: req.user, username: req.params.username, chat: chat.chat, blockedSend: blockedSend, blockedRecieve: blockedRecieve});
                    }
                });
            }
        }
    });
});

app.post('/chat/:username', function(req, res){
    var flag = 0;
    var index;
    for(var i = 0; i < req.user.chats.length; i++){
        if(req.user.chats[i].username === req.params.username){
            flag = 1;
            index = i;
            break;
        }
    }
    if(flag === 0){
        Chat.create({user1: req.user.username, user2: req.params.username}, function(err, chat){
            if(err){
                console.log(err);
            } else {
                chat.chat.push({username: req.user.username, message: req.body.message});
                chat.save();
                User.findOne({username: req.user.username}, function(err, user) {
                    if(err){
                        console.log(err);
                    } else {
                        user.chats.push({username: req.params.username, unreadMessages: 0, user1: true, user2: false});
                        user.save();
                        User.findOne({username: req.params.username}, function(err, user) {
                            if(err){
                                console.log(err);
                            } else {
                                user.chats.push({username: req.user.username, unreadMessages: 1, user1: false, user2: true});
                                user.save();
                                res.redirect('/chat/' + req.params.username);
                            }
                        });
                    }
                });
            }
        });
    } else {
        var user1, user2;
        if(req.user.chats[index].user1){
            user1 = req.user.username;
            user2 = req.params.username;
        } else {
            user1 = req.params.username;
            user2 = req.user.username;
        }
        Chat.findOne({user1: user1, user2: user2}, function(err, chat){
            if(err){
                console.log(err);
            } else {
                chat.chat.push({username: req.user.username, message: req.body.message});
                chat.save();
                User.findOne({username: req.params.username}, function(err, user) {
                    if(err){
                        console.log(err);
                    } else {
                        var index;
                        for(var i = 0; i < user.chats.length; i++){
                            if(user.chats[i].username === req.user.username){
                                index = i;
                                break;
                            }
                        }
                        user.chats[index].unreadMessages++;
                        user.save();
                        res.redirect('/chat/' + req.params.username);
                    }
                });
            }
        });
    }
});

app.get('/chat/delete/:username', function(req, res) {
    var user1, user2, index;
    for(var i = 0; i < req.user.chats.length; i++){
        if(req.user.chats[i].username === req.params.username){
            index = i;
            break;
        }
    }
    if(req.user.chats[index].user1){
        user1 = req.user.username;
        user2 = req.params.username;
    } else {
        user1 = req.params.username;
        user2 = req.user.username;
    }
    Chat.remove({user1: user1, user2: user2}, function(err, chat){
        if(err){
            console.log(err);
        } else {
            User.findOne({username:req.params.username}, function(err, user) {
                if(err){
                    console.log(err);
                } else {
                    var index;
                    for(var i = 0; i < user.chats.length; i++){
                        if(user.chats[i].username === req.user.username){
                            index = i;
                            break;
                        }
                    }
                    user.chats.splice(index, 1);
                    user.save();
                    User.findOne({_id: req.user._id}, function(err, user) {
                        if(err){
                            console.log(err);
                        } else {
                            var index;
                            for(var i = 0; i < user.chats.length; i++){
                                if(user.chats[i].username === req.params.username){
                                    index = i;
                                    break;
                                }
                            }
                            user.chats.splice(index, 1);
                            user.save();
                            res.redirect('/');
                        }
                    });
                }
            });
        }
    });
});

app.get('/chat/block/:username', function(req, res) {
    User.findOne({username: req.params.username}, function(err, sendUser) {
        if(err){
            console.log(err);
        } else {
            sendUser.blockedSend.push(req.user.username);
            sendUser.save();
            User.findOne({_id: req.user._id}, function(err, recieveUser) {
                if(err){
                    console.log(err);
                } else {
                    recieveUser.blockedRecieve.push(req.params.username);
                    recieveUser.save();
                    res.redirect('/chat/' + req.params.username);
                }
            });
        }
    });
});

app.get('/chat/unblock/:username', function(req, res) {
    User.findOne({username: req.params.username}, function(err, sendUser) {
        if(err){
            console.log(err);
        } else {
            for(var i = 0; i < sendUser.blockedSend.length; i++){
                if(sendUser.blockedSend[i] === req.user.username){
                    sendUser.blockedSend.splice(i, 1);
                    sendUser.save();
                    break;
                }
            }
            User.findOne({_id: req.user._id}, function(err, recieveUser) {
                if(err){
                    console.log(err);
                } else {
                    for(var i = 0; i < recieveUser.blockedRecieve.length; i++){
                        if(recieveUser.blockedRecieve[i] === req.params.username){
                            recieveUser.blockedRecieve.splice(i, 1);
                            recieveUser.save();
                            res.redirect('/chat/' + req.params.username);
                            break;
                        }
                    }
                }
            });
        }
    });
});

app.get('/addtowishlist/:filename', isLoggedIn, function(req, res) {
    Item.findOne({displayfilename: req.params.filename}, function(err, item){
        if(err){
            console.log(err);
        } else {
            User.findOne({_id: req.user._id}, function(err, user) {
                if(err){
                    console.log(err);
                } else {
                    user.wishlist.push({displayfilename: req.params.filename, itemname: item.itemname});
                    user.save();
                    res.redirect('/');
                }
            });
        }
    });
});

app.get('/removefromwishlist/:filename', isLoggedIn, function(req, res) {
    User.findOne({_id: req.user._id}, function(err, user) {
        if(err){
            console.log(err);
        } else {
            var index;
            for(var i = 0; i < user.wishlist.length; i++){
                if(user.wishlist[i].displayfilename === req.params.filename){
                    index = i;
                    break;
                }
            }
            user.wishlist.splice(index, 1);
            user.save();
            res.redirect('/item/' + req.params.filename);
        }
    });
});

app.post('/addprofilepicture', isLoggedIn, upload.single('file'), function(req, res) {
    User.findOne({_id: req.user._id}, function(err, user) {
        if(err){
            console.log(err);
        } else {
            user.profilePicture = req.file.filename;
            user.save();
            res.redirect('/profile');
        }
    });
});

app.listen(process.env.PORT, process.env.IP, function(){
    console.log("The server is running");
});