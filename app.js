const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
var fs = require("fs");
var path = require("path");
var fs = require('fs');
var path = require('path');
require('dotenv/config');
const _ = require("lodash");
let ejs = require('ejs');

const app = express();

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}, err => {
  console.log('connected')
});
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

/// Step 5 - set up multer for storing uploaded files

var multer = require('multer');

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads')
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now())
  }
});

var upload = multer({
  storage: storage
});
//-----------------Model part--------------------------
var imgModel = require('./model');
//------------------each book array-----------------------
//------------------server client handle------------------------------------
app.get("/", function(req, res) {
  res.render("home", {});
})
app.get("/home", function(req, res) {
  res.render("home", {});
});

app.get("/book", [paginationResults(imgModel), totalPage(imgModel)], function(req, res) {
  res.render("book", {
    items: res.paginationResults.results,
    totalPage: parseInt(res.totalPage),
    prevPage: res.paginationResults.prev,
    nextPage: res.paginationResults.next,
    currentPage: parseInt(req.query.page)
  });
});

app.get("/newBook", function(req, res) {
  res.render("newBook", {});
});

// app.get('/showBook', (req, res) => {
//   imgModel.find({}, (err, items) => {
//     if (err) {
//       console.log(err);
//       res.status(500).send('An error occurred', err);
//     } else {
//       res.render('showBook', {
//         items: items
//       });
//     }
//   });
// });

app.post('/showBook', upload.single('image'), (req, res, next) => {
  var obj = {
    bookName: req.body.bookName,
    authorName: req.body.authorName,
    desc: req.body.discription,
    bookmark: req.body.bookmark,
    imgName: req.file.filename,
    img: {
      data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
      contentType: 'image/png'
    }
  }
  imgModel.create(obj, (err, item) => {
    if (err) {
      console.log(err);
    } else {
      // item.save();
      res.redirect('/book?page=1&limit=6');
    }
  });
});

app.post("/delete", function(req, res) {
  imgModel.findOneAndDelete({
    _id: req.body.imgID
  }, (err, result) => {
    if (err) {
      console.log("delete fail");
    } else {
      fs.unlink("./uploads/" + req.body.imgName, function(err) {
        if (err) throw err;
        console.log("File deleted!");
      })
      res.redirect("/book?page=1&limit=6");
    }
  });
});

app.get("/showBook/:bookName", function(req, res) {
  // console.log(req.params.bookName);
  let bookName = req.params.bookName;
  imgModel.findOne({
    bookName: bookName
  }, function(err, book) {
    if (err) {
      console.log(err);

    } else {
      res.render("bookpage", {
        item: book
      });
    }
  });
});

app.get("/showBook/edit/:bookName", function(req, res) {
  res.render("update", {
    bookName: req.params.bookName
  });
});

app.post("/update/:bookName", function(req, res) {
  // console.log(req.body);
  // console.log(req.params.bookName);
  imgModel.findOneAndUpdate({
    bookName: req.params.bookName
  }, {
    bookmark: req.body.page,
    desc: req.body.desc
  }, function(err, log) {
    if (err) {
      console.log(err);
    } else {
      console.log(log);
    }
  });
  res.redirect("/showBook/" + req.params.bookName);
});

app.post("/showBook/handleReturn", function(req, res) {
  res.redirect("/book?page=1&limit=6");
});

let keyword;
app.post("/search", function(req, res) {
  keyword = req.body.keyword;
  res.redirect("/search");
});

app.get("/search", function(req, res) {
  let mySearch = "/" + keyword + "/i";
  //if we want to use the custom regex expression we should use the object to handle it
  imgModel.find({
    bookName: new RegExp(keyword, 'i')
  }, function(err, results) {
    if (err) {
      console.log(err);
    } else if (results.length === 0) {
      res.render("notfound");
    } else {
      res.render("search", {
        items: results
      });
    }
  });
});

app.get("/notfound", function(req, res) {
  res.render("notfound");
});

app.post("/gohome", function(req, res) {
  res.redirect("home");
});




// Step 8 - the POST handler for processing the uploaded file

function paginationResults(model) {
  return async (req, res, next) => {
    // here to set the section where we want to show
    const page = parseInt(req.query.page); //since the value passed from the url is string, so we change it to a integer.
    const limit = parseInt(req.query.limit);
    // since we use the array here is to set from and the end
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    //we want to show the prev and the next page we can create an object to handle this
    const results = {};
    if (endIndex < model.length + 1) {
      results.next = {
        page: page + 1,
        limit: limit
      }
    }
    if (startIndex > 0) {
      results.prev = {
        page: page - 1,
        limit: limit
      }
    }
    //the limit we can image it was the number of thing show on this page
    //skip is jump to the startIndex
    try {
      results.results = await model.find({}, null, {
        skip: startIndex,
        limit: limit
      }).exec();
      res.paginationResults = results;
      next();
    } catch (e) {
      res.status(500).json({
        message: e.message
      });
    } finally {

    }
    //pass to the res to handle the middleware callback function
    // call next this is according to the doc to keep do the next section.
  }
}

function totalPage(model) {
  return (req, res, next) => {
    model.count({}, function(err, count) {
      if (err) {
        console.log(err);
      } else {
        if (count % req.query.limit) {
          res.totalPage = (count / req.query.limit) + 1;
          next();
        } else {
          res.totalPage = count / req.query.limit;
          next();
        }
      }
    });
  }
}

let port = process.env.PORT;
if(port==null || port==""){
  port = 3000;
}

app.listen(port, () => {
  console.log("Example app listening at http://localhost:3000");
});
