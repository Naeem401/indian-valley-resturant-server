// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.47zrhkq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("ivr");
    const menuCollection = db.collection("menu");
    const usersCollection = db.collection("users");
    const cartsCollection = db.collection("carts");
    const ordersCollection = db.collection("orders");

    // Add this endpoint to create a payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { total } = req.body;
    
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: total * 100, // Convert to halalas (100 halalas = 1 SAR)
          currency: "sar", // Use SAR instead of USD
          payment_method_types: ["card"],
        });
    
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ message: "Failed to create payment intent" });
      }
    });

    // Admin Stats Endpoint
app.get("/admin-stats", async (req, res) => {
  try {
    const totalUsers = await usersCollection.countDocuments();
    const totalOrders = await ordersCollection.countDocuments();
    const totalSalesResult = await ordersCollection.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
        },
      },
    ]).toArray();

    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

    res.send({ totalUsers, totalSales, totalOrders });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).send({ message: "Failed to fetch admin stats" });
  }
});

    // ==================== MENU ENDPOINTS ====================
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.post("/menu", async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const updatedFields = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: updatedFields };
      const result = await menuCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // ==================== USER ENDPOINTS ====================
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.status(400).send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(user);
      const insertedUser = await usersCollection.findOne({ _id: result.insertedId });
      res.send(insertedUser);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user) {
        res.send(user);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // ==================== CART ENDPOINTS ====================
    app.post("/cart", async (req, res) => {
      const { userId, item } = req.body;

      if (!userId) {
        return res.status(400).send({ message: "User ID is required" });
      }

      try {
        let cart = await cartsCollection.findOne({ userId });

        if (cart) {
          const existingItem = cart.items.find((i) => i.itemId === item.itemId);
          if (existingItem) {
            existingItem.quantity += item.quantity;
          } else {
            cart.items.push(item);
          }
          await cartsCollection.updateOne(
            { userId },
            { $set: { items: cart.items } }
          );
        } else {
          await cartsCollection.insertOne({
            userId,
            items: [item],
            createdAt: new Date(),
          });
        }

        const updatedCart = await cartsCollection.findOne({ userId });
        res.send(updatedCart);
      } catch (error) {
        console.error("Error adding item to cart:", error);
        res.status(500).send({ message: "Failed to add item to cart" });
      }
    });

    app.get("/cart/:userId", async (req, res) => {
      const userId = req.params.userId;
      const cart = await cartsCollection.findOne({ userId });
      res.send(cart || { items: [] });
    });

    app.patch("/cart/:userId/item/:itemId", async (req, res) => {
      const { userId, itemId } = req.params;
      const { newQuantity } = req.body;

      try {
        const cart = await cartsCollection.findOne({ userId });
        if (!cart) return res.status(404).send({ message: "Cart not found" });

        const itemIndex = cart.items.findIndex((i) => i.itemId === itemId);
        if (itemIndex === -1) {
          return res.status(404).send({ message: "Item not found in cart" });
        }

        if (newQuantity <= 0) {
          cart.items.splice(itemIndex, 1);
        } else {
          cart.items[itemIndex].quantity = newQuantity;
        }

        if (cart.items.length === 0) {
          await cartsCollection.deleteOne({ userId });
        } else {
          await cartsCollection.updateOne(
            { userId },
            { $set: { items: cart.items } }
          );
        }

        const updatedCart = await cartsCollection.findOne({ userId }) || { items: [] };
        res.send(updatedCart);
      } catch (error) {
        console.error("Error updating cart:", error);
        res.status(500).send({ message: "Failed to update cart" });
      }
    });

    app.delete("/cart/:userId/item/:itemId", async (req, res) => {
      const { userId, itemId } = req.params;

      try {
        const cart = await cartsCollection.findOne({ userId });
        if (!cart) return res.status(404).send({ message: "Cart not found" });

        const updatedItems = cart.items.filter((i) => i.itemId !== itemId);
        
        if (updatedItems.length === 0) {
          await cartsCollection.deleteOne({ userId });
        } else {
          await cartsCollection.updateOne(
            { userId },
            { $set: { items: updatedItems } }
          );
        }

        res.send({ message: "Item removed successfully" });
      } catch (error) {
        console.error("Error removing item:", error);
        res.status(500).send({ message: "Failed to remove item" });
      }
    });

    app.delete("/cart/:userId", async (req, res) => {
      const userId = req.params.userId;
      await cartsCollection.deleteOne({ userId });
      res.send({ message: "Cart cleared successfully" });
    });

    // ==================== ORDER ENDPOINTS ====================
    app.post("/orders", async (req, res) => {
      const { userId, items, total, type, paymentMethod, mobileNumber, deliveryAddress, numberOfPeople, pickupTime, customerName, customerEmail, customerAddress } = req.body;
      const order = {
        userId,
        items,
        total,
        status: "pending",
        type,
        paymentMethod,
        mobileNumber,
        ...(deliveryAddress && { deliveryAddress }),
        ...(numberOfPeople && { numberOfPeople }),
        ...(pickupTime && { pickupTime }),
        customerName,
        customerEmail,
        customerAddress,
        createdAt: new Date(),
      };
      await ordersCollection.insertOne(order);
      await cartsCollection.deleteOne({ userId });
      res.send({ message: "Order placed successfully" });
    });

    app.get("/orders", async (req, res) => {
      const result = await ordersCollection.find().toArray();
      res.send(result);
    });

    app.get("/orders/:userId", async (req, res) => {
      const userId = req.params.userId;
      const result = await ordersCollection.find({ userId }).toArray();
      res.send(result);
    });

    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status } };
      await ordersCollection.updateOne(query, updateDoc);
      res.send({ message: "Order status updated" });
    });

    app.get("/orders-with-users", async (req, res) => {
      try {
        const orders = await ordersCollection.aggregate([
          {
            $addFields: {
              userIdObj: { $toObjectId: "$userId" } // Convert userId (string) to ObjectId
            }
          },
          {
            $lookup: {
              from: "users", // The collection to join with
              localField: "userIdObj", // The converted ObjectId field
              foreignField: "_id", // The _id field in the users collection
              as: "user" // The name of the joined array
            }
          },
          { $unwind: "$user" }, // Unwind the joined user array
          {
            $addFields: {
              // Add fields from the joined user document
              customerName: "$user.name",
              customerEmail: "$user.email",
              customerAddress: "$user.address"
            }
          },
          { $project: { user: 0, userIdObj: 0 } } // Remove unnecessary fields
        ]).toArray();
    
        res.send(orders);
      } catch (error) {
        console.error("Error fetching orders with users:", error);
        res.status(500).send({ message: "Failed to fetch orders" });
      }
    });
    
    // ==================== START SERVER ====================
    app.get("/", (req, res) => {
      res.send("Indian Valley Restaurant Server is Running");
    });

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);