const express = require('express');
const cors = require('cors');
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d2rf7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const courseCollection = client.db('fujiamaDB').collection('all-courses');
    const usersCollection = client.db('fujiamaDB').collection('all-users');

    //courses section section
    app.get('/all-courses', async (req, res) => {
      const cursor = courseCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      //   console.log(result);
    })


    //user section

    app.post('/all-users', async (req, res) => {
      const user = req.body
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "account already exist" });
      }
      else {
        const result = await usersCollection.insertOne(user)
        return res.send(result)
      }
    });


    app.get('/all-users', async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/all-users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.findOne(query);
      res.send(result);
  })

  // update user data
    
  app.put('/all-users/:id', async (req, res) => {
    const id = req.params.id;
    const updatedProfile = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: {
            displayName: updatedProfile.displayName,
            phone: updatedProfile.phone,
            address: updatedProfile.address,
            photoURL: updatedProfile.photoURL
        },
    };
    const result = await usersCollection.updateOne(filter, updateDoc);
    res.send(result);
});
 
  //Enrolled Courses
  app.get('/all-users/:id/enrolled', async (req, res) => {
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

  app.put('/all-users/:id/enrolled', async (req, res) => {
    const id = req.params.id;
    const newEnrollment = req.body; // The new course to be added
  
    const query = { _id: new ObjectId(id) };
      const update = {
        $push: { Enrolled: newEnrollment } // Add the new course to the Enrolled array
      };
  
      const result = await usersCollection.updateOne(query, update);
  
      if (result.matchedCount > 0) {
        res.send({ message: "Enrollment updated successfully", result });
      } else {
        res.status(404).send({ message: "User not found" });
      }
  });




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send(' server in running ')
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`)
})

