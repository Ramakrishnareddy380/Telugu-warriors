const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables from .env file

const Schema = mongoose.Schema;

// Define schemas
const adminSchema = new Schema({
  username: String,
  password: String,
});

const userSchema = new Schema({
  username: String,
  password: String,
  purchasedCourses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
});

const courseSchema = new Schema({
  title: String,
  description: String,
  price: Number,
  imageLink: String,
  published: {
    type: Boolean,
    default: true,
  },
  createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
});

// Create models
const User = mongoose.model("User", userSchema);
const Admin = mongoose.model("Admin", adminSchema);
const Course = mongoose.model("Course", courseSchema);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: "Sell-Courses",
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

const app = express();

app.use(cors());
app.use(bodyParser.json());

const secretOrPrivateKey = "SECRET";

// Middleware for authentication
function isAuthenticated(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Missing Auth Header" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, secretOrPrivateKey, (err, data) => {
    if (err) {
      return res.status(404).send({ message: "Unauthorized" });
    }
    req.data = data;
    next();
  });
}

// Middleware for admin role check
function isAdmin(req, res, next) {
  if (!(req.data.role === "Admin")) {
    return res.status(404).send({ message: "Admins Only Allowed" });
  }
  next();
}

//! Admin Routes

//* Sign Up
app.post("/admin/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .send({ message: "Username and password are required." });
  }

  let admin = await Admin.findOne({ username });

  if (admin) {
    return res
      .status(409)
      .send({ message: "User already exists, Please login" });
  }

  admin = await Admin.create({ username, password });

  const token = jwt.sign({ username, role: "Admin" }, secretOrPrivateKey, {
    expiresIn: "1h",
  });

  res.send({ message: "Admin created successfully", token });
});

//* Sign In
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .send({ message: "Username and password are required." });
  }

  let admin = await Admin.findOne({ username, password });

  if (!admin) {
    return res.status(401).send({ message: "Incorrect username or password" });
  }

  const token = jwt.sign({ username, role: "Admin" }, secretOrPrivateKey, {
    expiresIn: "1h",
  });

  res.send({ message: "Admin Loggedin successfully", token });
});

//* View Courses
app.get("/admin/courses", isAuthenticated, isAdmin, async (req, res) => {
  let Courses = await Course.find({}).populate("createdBy");
  res.send({ Courses });
});

//* Create Courses
app.post("/admin/courses", isAuthenticated, isAdmin, async (req, res) => {
  const { title, description, imageLink, price, published } = req.body;

  if (!title || !description || !imageLink || !price) {
    return res.status(400).send({ message: "Course details missing" });
  }

  let course = await Course.findOne({ title });

  if (course) {
    return res.status(409).send({ message: "Course already exists," });
  }

  const createdBy = req.data.username;
  const admin = await Admin.findOne({ username: createdBy });

  if (!admin) {
    return res.status(404).send({ message: "Course Creator not found" });
  }

  course = await Course.create({
    ...req.body,
    createdBy: admin._id,
  });

  res.send({ message: "Course Created Successfully" });
});

//* Delete Courses
app.delete("/admin/courses/:id", isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;

  let validId = mongoose.Types.ObjectId.isValid(id);

  if (!validId) {
    return res.status(404).send({ message: "Invalid Course ID" });
  }

  let course = await Course.findById(id);

  if (!course) {
    return res.status(404).send({ message: "Course doesn't exists" });
  }

  course = await Course.findByIdAndDelete(id, {
    new: true,
  });

  if (!course) {
    return res.status(404).send({ message: "Course not found" });
  }

  res.send({ message: "Course Deleted Successfully" });
});

//* Update Courses
app.put("/admin/courses/:id", isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;

  let validId = mongoose.Types.ObjectId.isValid(id);

  if (!validId) {
    return res.status(404).send({ message: "Invalid Course ID" });
  }

  const { title, description, imageLink, price, published } = req.body;

  if (!title || !description || !imageLink || !price) {
    return res.status(400).send({ message: "Course details missing" });
  }

  let course = await Course.findById(id);

  if (!course) {
    return res.status(404).send({ message: "Course doesn't exists" });
  }

  course = await Course.findByIdAndUpdate(id, req.body, {
    new: true,
  });

  if (!course) {
    return res.status(404).send({ message: "Course not found" });
  }

  res.send({ message: "Course Updated Successfully" });
});

//* View a Course
app.get("/admin/courses/:id", isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;

  let validId = mongoose.Types.ObjectId.isValid(id);

  if (!validId) {
    return res.status(404).send({ message: "Invalid Course ID" });
  }

  let course = await Course.findById(id).populate("createdBy");

  if (!course) {
    return res.status(404).send({ message: "Course doesn't exists" });
  }

  res.send({ currentCourse: course });
});

//! User Routes

//* Sign Up
app.post("/users/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .send({ message: "Username and password are required." });
  }

  let user = await User.findOne({ username });

  if (user) {
    return res
      .status(409)
      .send({ message: "User already exists, Please login" });
  }

  user = await User.create({ username, password });

  const token = jwt.sign({ username, role: "User" }, secretOrPrivateKey, {
    expiresIn: "1h",
  });

  res.send({ message: "user created successfully", token });
});

//* Sign In
app.post("/users/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .send({ message: "Username and password are required." });
  }

  let user = await User.findOne({ username, password });

  if (!user) {
    return res.status(401).send({ message: "Incorrect username or password" });
  }

  const token = jwt.sign({ username, role: "User" }, secretOrPrivateKey, {
    expiresIn: "1h",
  });

  res.send({ message: "User Loggedin successfully", token });
});

//* View Courses
app.get("/users/courses", isAuthenticated, async (req, res) => {
  let Courses = await Course.find({ published: true }).populate("createdBy");
  res.send({ Courses });
});

//* View a Course
app.get("/users/courses/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;

  let validId = mongoose.Types.ObjectId.isValid(id);

  if (!validId) {
    return res.status(404).send({ message: "Invalid Course ID" });
  }

  let course = await Course.findById(id);

  if (!course) {
    return res.status(404).send({ message: "Course doesn't exists" });
  }

  res.send({ currentCourse: course });
});

//* Purchase Courses
app.post("/users/courses/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;

  let validId = mongoose.Types.ObjectId.isValid(id);

  if (!validId) {
    return res.status(404).send({ message: "Invalid Course ID" });
  }

  let course = await Course.findById(id);

  if (!course) {
    return res.status(404).send({ message: "Course doesn't exists" });
  }

  const { username } = req.data;

  let user = await User.findOne({ username });

  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }

  const isPurchased = user.purchasedCourses.find((course) => {
    return String(course) === id;
  });

  if (isPurchased) {
    return res.status(409).send({ message: "Course already purchased," });
  }

  user.purchasedCourses.push(course);
  await user.save();

  res.send({ message: "Course Purchased Successfully" });
});

//* View Purchased Courses
app.get("/users/purchasedCourses", isAuthenticated, async (req, res) => {
  const { username } = req.data;

  let user = await User.findOne({ username }).populate("purchasedCourses");

  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }

  res.send({ purchasedCourses: user.purchasedCourses || [] });
});

//* General Routes
app.get("/me", isAuthenticated, (req, res) => {
  res.send({ username: req.data.username });
});

app.get("/", (req, res) => {
  res.send("Hello");
});

app.get("/profile", isAuthenticated, (req, res) => {
  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("Listening on port 3000");
});