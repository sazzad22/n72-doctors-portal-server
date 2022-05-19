const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xpx7w.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctors_portal").collection("service");
    const bookingCollection = client
      .db("doctors_portal")
      .collection("bookings");
    const userCollection = client
      .db("doctors_portal")
      .collection("users");

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    //user
    // adding users to db - upsert is used so that is same user comes in ,it won't add the same user to the db multiple time
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      
      const filter = { email: email };
      const options={upsert:true}
      const updateDoc = {
        $set: user
      }
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token= jwt.sign({email:email}, process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'})
      res.send({ result,token })
    })

    // here we will try to filter the time slots that are available after booking some of the time slots of that day

    //it's not the proper way of query
    //after learning more mongodb -use aggregate lookup,pipeline, match,group - read documentation
    app.get("/available", async (req, res) => {
      const date = req.query.date || "May 16, 2022";

      //step 1. get all the services
      const services = await serviceCollection.find().toArray();
      //step 2 - get the bookings of that day
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();
      // step 3 - filter the services with the booking and get the booked services
      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (b) => b.treatment === service.name
        ); //we get array of booked services
        //from that we take the slots
        //and set the slots(which are booked)  to the each service obj as a new property
        const booked = serviceBookings.map((s) => s.slot);
        // service.booked = booked;
        //here booked and service.slot are two array - we remove booked from service.slot to find available
        const available = service.slots.filter((s) => !booked.includes(s));
        service.slots = available;
      });

      res.send(services);
    });

    /**
     * API naming convention
     * app.get ('/booking') //get all bookings
     * app.get("/booking/:id") // get a specific booking
     * app.post("/booking") // add a new booking
     * app.patch("/booking/:id") // update a booking value
     * app.delete("/booking/:id")// delete a booking
     */

    // booking
    app.get('/booking', async (req, res) => {
      const patient = req.query.patient;
      const query = { patient: patient };
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
    })
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Doctors app listening on port ${port}`);
});
