const express = require('express');
const app = express();
const userRoutes = require('./routes/userRoutes');
const { connectDB } = require('./connection');
const User = require('./models/User');
const Message = require('./models/Message')
const rooms = ['general', 'tech', 'finance', 'crypto'];
const cors = require('cors');

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.options('http://localhost:3000', cors())


var allowlist = ['http://localhost:3000']
let whitelist = ['http://localhost:3000','http://localhost:80'];
let corsOptions = {
    origin: (origin, callback)=>{
        if (whitelist.indexOf(origin) !== -1) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    },credentials: true
}
app.use(cors(corsOptions));

// app.use(cors({origin: 'http://localhost:3000'}));

app.use('/users',  userRoutes)

// Connect to MongoDB
connectDB();

const server = require('http').createServer(app);
const PORT = 5001;
const io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})


async function getLastMessagesFromRoom(room){
  let roomMessages = await Message.aggregate([
    {$match: {to: room}},
    {$group: {_id: '$date', messagesByDate: {$push: '$$ROOT'}}}
  ])
  return roomMessages;
}

function sortRoomMessagesByDate(messages){
  return messages.sort(function(a, b){
    let date1 = a._id.split('/');
    let date2 = b._id.split('/');

    date1 = date1[2] + date1[0] + date1[1]
    date2 =  date2[2] + date2[0] + date2[1];

    return date1 < date2 ? -1 : 1
  })
}

// socket connection

io.on('connection', (socket)=> {

  socket.on('new-user', async ()=> {
    const members = await User.find();
    io.emit('new-user', members)
  })

  socket.on('join-room', async(newRoom, previousRoom)=> {
    socket.join(newRoom);
    socket.leave(previousRoom);
    let roomMessages = await getLastMessagesFromRoom(newRoom);
    roomMessages = sortRoomMessagesByDate(roomMessages);
    socket.emit('room-messages', roomMessages)
  })

  socket.on('message-room', async(room, content, sender, time, date) => {
    try {
        // Create a new message object
        const newMessage = new Message({ content, from: sender, time, date, to: room });
        roomMessages = sortRoomMessagesByDate(roomMessages);
        // Save the message to the database
        await newMessage.save();

        // Emit the message to all clients in the room
        io.to(room).emit('new-message', newMessage);
    } catch (error) {
        console.error('Error saving message:', error);
    }
});
  app.delete('/logout', async(req, res)=> {
    try {
      const {_id, newMessages} = req.body;
      const user = await User.findById(_id);
      user.status = "offline";
      user.newMessages = newMessages;
      await user.save();
      const members = await User.find();
      socket.broadcast.emit('new-user', members);
      res.status(200).send();
    } catch (e) {
      console.log(e);
      res.status(400).send()
    }
  })

})


app.get('/rooms', (req, res)=> {
  res.json(rooms)
})


server.listen(PORT, ()=> {
  console.log('listening to port', PORT)
})
