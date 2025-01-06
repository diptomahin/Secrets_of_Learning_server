const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware

// middleware

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [`http://localhost:5173`];
    // Allow requests with no origin, such as mobile apps, or specific allowed origins
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

// Use CORS middleware
app.use(cors(corsOptions));

// Add the video streaming route here
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res, path) => {
      if (path.endsWith(".mp4")) {
        res.setHeader("Content-Type", "video/mp4");
      }
    },
  })
);

app.use(
  "/ebooks",
  express.static(path.join(__dirname, "ebooks"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
      }
    },
  })
);

app.use(express.json({ limit: "5gb" })); // Set to 2GB
app.use(express.urlencoded({ limit: "5gb", extended: true }));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d2rf7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Multer configuration for large video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Set up multer with a larger file size limit
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB file size limit
});

// Multer configuration for PDF uploads
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "ebooks");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); // Ensure directory structure exists
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadPdf = multer({
  storage: pdfStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB file size limit
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".pdf") {
      return cb(new Error("Only PDF files are allowed!"));
    }
    cb(null, true);
  },
});

module.exports = { upload, uploadPdf };

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const courseCollection = client.db("fujiamaDB").collection("all-courses");
    const liveCourseCollection = client
      .db("fujiamaDB")
      .collection("live-courses");
    const ebookCollection = client.db("fujiamaDB").collection("all-ebooks");
    const usersCollection = client.db("fujiamaDB").collection("all-users");
    const LiveEnrollmentCollection = client
      .db("fujiamaDB")
      .collection("live-enroll");
    const LiveRecordCollection = client
      .db("fujiamaDB")
      .collection("live-records");
    const ClassRecordCollection = client
      .db("fujiamaDB")
      .collection("class-records");
    const BannerCollection = client.db("fujiamaDB").collection("home-banner");

    //home-banner
    app.get("/home-banner", async (req, res) => {
      const cursor = BannerCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      //   console.log(result);
    });

    app.get("/home-banner/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await BannerCollection.findOne(query);
      res.send(result);
    });

    app.put("/home-banner/:id", async (req, res) => {
      const id = req.params.id;
      const { _id, ...updatedBanner } = req.body; // Destructure _id out to exclude it from the update

      try {
        const result = await BannerCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedBanner }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "Banner not found or no changes made." });
        }

        return res.send({ message: "Banner updated successfully", result });
      } catch (error) {
        return res
          .status(500)
          .send({ message: "Failed to update banner", error });
      }
    });

    //courses section section
    app.get("/all-courses", async (req, res) => {
      const cursor = courseCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      //   console.log(result);
    });
    app.post("/all-courses", async (req, res) => {
      const course = req.body;

      try {
        const result = await courseCollection.insertOne(course);
        return res.send(result);
      } catch (error) {
        return res.status(500).send({ message: "Failed to add course", error });
      }
    });

    app.post("/upload-video", upload.single("file"), async (req, res) => {
      try {
        console.log("Upload video endpoint hit");
        if (!req.file) {
          return res.status(400).send({ message: "No video file uploaded" });
        }
        const videoPath = `/uploads/${req.file.filename}`;
        res.send({ url: videoPath });
      } catch (error) {
        console.error("Error during video upload:", error);
        res
          .status(500)
          .send({ message: "Failed to upload video", error: error.message });
      }
    });

    //delete video
    app.delete("/delete-video", (req, res) => {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "Video URL is required." });
      }

      // Convert the video URL to the server file path
      const videoPath = path.join(
        __dirname,
        "uploads",
        url.split("/uploads/")[1]
      );

      // Check if the file exists, and then delete it
      fs.access(videoPath, fs.constants.F_OK, (err) => {
        if (err) {
          console.error("File does not exist:", videoPath);
          return res.status(404).json({ error: "Video not found." });
        }

        // Delete the file
        fs.unlink(videoPath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
            return res.status(500).json({ error: "Failed to delete video." });
          }

          console.log("File deleted successfully:", videoPath);
          res.status(200).json({ message: "Video deleted successfully." });
        });
      });
    });

    // Recorded video for Recorded course
    app.post("/class-records", async (req, res) => {
      const course = req.body;

      try {
        const result = await ClassRecordCollection.insertOne(course);
        return res.send(result);
      } catch (error) {
        return res.status(500).send({ message: "Failed to add course", error });
      }
    });

    app.put("/class-records/:id", async (req, res) => {
      const courseId = req.params.id; // Get the ID from the URL
      const updatedCourse = req.body; // Get the updated course data from the request body

      try {
        const result = await ClassRecordCollection.updateOne(
          { _id: new ObjectId(courseId) }, // Find course by ID
          { $set: updatedCourse } // Update the course with new data
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "Course not found or no changes made." });
        }

        return res.send({ message: "Course updated successfully", result });
      } catch (error) {
        return res
          .status(500)
          .send({ message: "Failed to update course", error });
      }
    });

    app.get("/class-records", async (req, res) => {
      const cursor = ClassRecordCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      //   console.log(result);
    });

    // Recorded video for live course
    app.post("/live-records", async (req, res) => {
      const course = req.body;

      try {
        const result = await LiveRecordCollection.insertOne(course);
        return res.send(result);
      } catch (error) {
        return res.status(500).send({ message: "Failed to add course", error });
      }
    });

    app.put("/live-records/:id", async (req, res) => {
      const courseId = req.params.id; // Get the ID from the URL
      const updatedCourse = req.body; // Get the updated course data from the request body

      try {
        const result = await LiveRecordCollection.updateOne(
          { _id: new ObjectId(courseId) }, // Find course by ID
          { $set: updatedCourse } // Update the course with new data
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "Course not found or no changes made." });
        }

        return res.send({ message: "Course updated successfully", result });
      } catch (error) {
        return res
          .status(500)
          .send({ message: "Failed to update course", error });
      }
    });

    app.get("/live-records", async (req, res) => {
      const cursor = LiveRecordCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      //   console.log(result);
    });

    //live course
    app.get("/live-courses", async (req, res) => {
      const cursor = liveCourseCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      //   console.log(result);
    });
    app.post("/live-courses", async (req, res) => {
      const course = req.body;

      try {
        const result = await liveCourseCollection.insertOne(course);
        return res.send(result);
      } catch (error) {
        return res.status(500).send({ message: "Failed to add course", error });
      }
    });

    app.get("/live-courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await liveCourseCollection.findOne(query);
      res.send(result);
    });

    app.put("/live-courses/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedCourse = req.body;

        // Validate if the id is a valid ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid course ID format" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            title: updatedCourse.title,
            url_id: updatedCourse.url_id,
            trainer: updatedCourse.trainer,
            description: updatedCourse.description,
            short_description: updatedCourse.short_description,
            trailer: updatedCourse.trailer,
            offer: updatedCourse.offer,
            price: updatedCourse.price,
            discount: updatedCourse.discount,
            status: updatedCourse.status,
            students: updatedCourse.students,
            reviews: updatedCourse.reviews,
            positive_ratings: updatedCourse.positive_ratings,
            whatYoullLearn: updatedCourse.whatYoullLearn,
            software: updatedCourse.software,
            courseFeatures: updatedCourse.courseFeatures,
            course_type: updatedCourse.course_type,
            deadline: updatedCourse.deadline,
          },
        };

        const result = await liveCourseCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
          res
            .status(200)
            .send({ message: "Course updated successfully", result });
        } else {
          res
            .status(404)
            .send({ message: "Course not found or no changes made" });
        }
      } catch (error) {
        console.error("Error updating course:", error);
        res.status(500).send({ message: "Failed to update course", error });
      }
    });

    app.post("/live-enroll", async (req, res) => {
      const enrollmentData = req.body;

      try {
        // Insert data into MongoDB
        const result = await client
          .db("fujiamaDB")
          .collection("live-enroll")
          .insertOne(enrollmentData);
        return res.status(201).send({
          message: "Enrollment successful and added to Google Sheet",
          result,
        });
      } catch (error) {
        console.error("Enrollment Error:", error); // Log the specific error
        return res.status(500).send({
          message: "Failed to enroll in course or add to Google Sheet",
          error: error.message,
        });
      }
    });

    app.get("/live-enroll", async (req, res) => {
      const cursor = LiveEnrollmentCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      //   console.log(result);
    });

    app.delete("/live-enroll/:id", async (req, res) => {
      const enrollmentId = req.params.id;

      try {
        const query = { _id: new ObjectId(enrollmentId) }; // Assuming you're using MongoDB ObjectId
        const result = await LiveEnrollmentCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({ message: "Enrollment deleted successfully" });
        } else {
          res.status(404).send({ message: "Enrollment not found" });
        }
      } catch (error) {
        res.status(500).send({
          message: "An error occurred while deleting the enrollment",
          error,
        });
      }
    });

    // PUT request to update the status of an enrollment by ID
    app.put("/live-enroll/:id", async (req, res) => {
      const enrollmentId = req.params.id;
      const { status } = req.body; // The new status comes from the request body

      try {
        // Find the enrollment by its _id and update its status
        const filter = { _id: new ObjectId(enrollmentId) };
        const updateDoc = {
          $set: { status: status }, // Update only the 'status' field
        };

        const result = await LiveEnrollmentCollection.updateOne(
          filter,
          updateDoc
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Enrollment not found" });
        }

        res.send({
          message: "Enrollment status updated successfully",
          result: result,
        });
      } catch (error) {
        res.status(500).send({
          message: "Failed to update enrollment status",
          error: error.message,
        });
      }
    });

    //user section

    app.post("/all-users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "account already exist" });
      } else {
        const result = await usersCollection.insertOne(user);
        return res.send(result);
      }
    });

    app.get("/all-users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/all-users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // update user data

    app.put("/all-users/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProfile = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          displayName: updatedProfile.displayName,
          phone: updatedProfile.phone,
          address: updatedProfile.address,
          photoURL: updatedProfile.photoURL,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //Enrolled Courses
    app.get("/all-users/:id/enrolled", async (req, res) => {
      const id = req.params.id;

      // Convert the id parameter to a MongoDB ObjectId
      const query = { _id: new ObjectId(id) };

      // Find the user by their _id
      const user = await usersCollection.findOne(query);

      if (user) {
        // Send the Enrolled array as the response
        res.send(user.Enrolled || []);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    app.put("/all-users/:id/enrolled", async (req, res) => {
      const id = req.params.id;
      const newEnrollment = req.body; // The new course to be added

      const query = { _id: new ObjectId(id) };
      const update = {
        $push: { Enrolled: newEnrollment }, // Add the new course to the Enrolled array
      };

      const result = await usersCollection.updateOne(query, update);

      if (result.matchedCount > 0) {
        res.send({ message: "Enrollment updated successfully", result });
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    app.get("/all-users/:id/live_enroll", async (req, res) => {
      const id = req.params.id;

      // Convert the id parameter to a MongoDB ObjectId
      const query = { _id: new ObjectId(id) };

      // Find the user by their _id
      const user = await usersCollection.findOne(query);

      if (user) {
        // Send the Enrolled array as the response
        res.send(user.live_enroll || []);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    app.put("/all-users/:id/live_enroll", async (req, res) => {
      const id = req.params.id;
      const newEnrollment = req.body; // The new course to be added

      const query = { _id: new ObjectId(id) };
      const update = {
        $push: { live_enroll: newEnrollment }, // Add the new course to the Enrolled array
      };

      const result = await usersCollection.updateOne(query, update);

      if (result.matchedCount > 0) {
        res.send({ message: "Enrollment updated successfully", result });
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });
    // E-Book section
    app.get("/all-ebooks", async (req, res) => {
      const cursor = ebookCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/all-ebooks/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ebookCollection.findOne(query);
      res.send(result);
    });

    app.post("/all-ebooks", async (req, res) => {
      const course = req.body;

      try {
        const result = await ebookCollection.insertOne(course);
        return res.send(result);
      } catch (error) {
        return res.status(500).send({ message: "Failed to add ebook", error });
      }
    });
    app.put("/all-ebooks/:id", async (req, res) => {
      try {
        const id = req.params.id; // Get course ID from the URL params
        const updatedEbook = req.body; // Get updated course data from the request body

        // Validate if the id is a valid ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Ebook ID format" });
        }

        // Define the filter and the update document
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            title: updatedEbook.title,
            subtitle: updatedEbook.subtitle,
            url: updatedEbook.url,
            description: updatedEbook.description,
            pdf: updatedEbook.pdf, // Assuming this is the file URL/path
            preview: updatedEbook.preview, // Assuming this is the preview file URL/path
            price: updatedEbook.price,
            highlights: updatedEbook.highlights,
            contentDetails: updatedEbook.contentDetails,
            faq: updatedEbook.faq,
            disclaimer: updatedEbook.disclaimer,
          },
        };

        // Perform the update in the database
        const result = await ebookCollection.updateOne(filter, updateDoc);

        // Check if any document was modified
        if (result.modifiedCount > 0) {
          return res
            .status(200)
            .send({ message: "Ebook updated successfully", result });
        } else {
          return res
            .status(404)
            .send({ message: "Ebook not found or no changes made" });
        }
      } catch (error) {
        console.error("Error updating Ebook:", error);
        return res
          .status(500)
          .send({ message: "Failed to update Ebook", error });
      }
    });

    app.post("/upload/pdf", (req, res) => {
      uploadPdf.single("pdf")(req, res, (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        res.status(200).json({
          message: "PDF uploaded successfully",
          filePath: `/ebooks/${req.file.filename}`,
        });
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(" server in running ");
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
