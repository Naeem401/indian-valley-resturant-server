const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;


//middileware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.47zrhkq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();
    const menuCollection = client.db("ivr").collection("menu");
    const usersCollection = client.db('ivr').collection('users');


    app.get('/menu', async(req, res) => {
        const result = await menuCollection.find().toArray();
        res.send(result)
    })
   // Route to save user data
   app.post('/users', async (req, res) => {
    const user = req.body; // User data from the frontend

    // Check if the user already exists in the database
    const query = { email: user.email }; // Assuming email is unique for each user
    const existingUser = await usersCollection.findOne(query);

    if (existingUser) {
      // If the user already exists, send a response indicating that
      return res.status(400).send({ message: 'User already exists!' });
    }

    // If the user doesn't exist, save the user data
    const result = await usersCollection.insertOne(user);
    res.send(result);
  });

  // Route to get all users
  app.get('/users', async (req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
  });

// Route to get a user by email
app.get('/user/:email', async (req, res) => {
  const email = req.params.email; // Get the email from the URL parameter
  const query = { email: email }; // Create a query to find the user by email
  const user = await usersCollection.findOne(query);

  if (user) {
    // If the user is found, send the user data
    res.send(user);
  } else {
    // If the user is not found, send a 404 response
    res.status(404).send({ message: 'User not found!' });
  }
});

// Route to save item data to the menu collection
app.post('/menu', async (req, res) => {
  const item = req.body; // Item data from the frontend

  try {
    // Save the item to the menu collection
    const result = await menuCollection.insertOne(item);
    res.send(result);
  } catch (error) {
    console.error('Error saving item:', error);
    res.status(500).send({ message: 'Failed to save item' });
  }
});

 // Route to delete a menu item by ID
 app.delete('/menu/:id', async (req, res) => {
  const id = req.params.id; // Get the ID from the URL parameter

  try {
    // Convert the ID to an ObjectId
    const query = { _id: new ObjectId(id) };

    // Delete the item from the menu collection
    const result = await menuCollection.deleteOne(query);

    if (result.deletedCount === 1) {
      res.send({ message: 'Item deleted successfully!' });
    } else {
      res.status(404).send({ message: 'Item not found!' });
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).send({ message: 'Failed to delete item' });
  }
});

// Route to update a menu item by ID
app.put('/menu/:id', async (req, res) => {
  const id = req.params.id; // Get the ID from the URL parameter
  const updatedItem = req.body; // Updated item data from the frontend

  try {
    // Convert the ID to an ObjectId
    const query = { _id: new ObjectId(id) };

    // Define the update operation
    const updateDoc = {
      $set: updatedItem, // Update all fields with the new data
    };

    // Update the item in the menu collection
    const result = await menuCollection.updateOne(query, updateDoc);

    if (result.matchedCount === 1) {
      res.send({ message: 'Item updated successfully!' });
    } else {
      res.status(404).send({ message: 'Item not found!' });
    }
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).send({ message: 'Failed to update item' });
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
    res.send('Indian-Valley-Resturant Server is Running')
})

app.listen(port, () => {
    console.log(`Indian Valley Resturant is Running Port ${port}`)
})