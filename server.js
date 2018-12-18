var express = require('express'); 
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http); 

// Serve the index page 
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/index.html'); 
});

// Listen on port 5000
app.set('port', (process.env.PORT || 5000));
http.listen(app.get('port'), function(){
  console.log('listening on port',app.get('port'));
});

// ---

var players = {}; 
var bullet_array = []; 
var leaderboard = {}; 

//Screen info
var WINDOW_WIDTH = 1920;
var WINDOW_HEIGHT = 1080;

io.on('connection', function(socket){
  
	// Listen for a new player trying to connect
	socket.on('new-player',function(state){
		console.log("New player joined with state:",state);
		players[socket.id] = state;
		io.emit('update-players',players);
	});
  
  // Listen for a disconnection and update our player table 
  socket.on('disconnect',function(state){
    delete players[socket.id];
    io.emit('update-players',players);
  });
  
  // Listen for move events and tell all other clients that something has moved this is for players 
  socket.on('move-player',function(position_data){
    if(players[socket.id] == undefined) return; 
    players[socket.id].x = position_data.x;  
    players[socket.id].y = position_data.y; 
    players[socket.id].angle = position_data.angle; 
    io.emit('update-players',players);
  });
  
  // Listen for shoot-bullet events and add it to our bullet array
  socket.on('shoot-bullet',function(data){
    if(players[socket.id] == undefined) return;
    var new_bullet = data;
    data.owner_id = socket.id; 
    if(Math.abs(data.speed_x) > 20 || Math.abs(data.speed_y) > 20){
      console.log("Player",socket.id,"is cheating!");
    }
    bullet_array.push(new_bullet);
  });
});
function compareDamage(topUserA, topUserB) {
  return topUserA.damage < topUserB.damage;
}

function ServerGameLoop(){
  
  //Update leaderboard
  var topUsers = [];
  for(var id in players)
      if(players[id] != undefined)
          topUsers.push({ nickname: players[id].nickname, damage: players[id].damage, taken_damage: players[id].taken_damage });
  
  topUsers.sort(compareDamage);     
  io.emit("leaderboard-update", topUsers);
  
  for(var i=0;i<bullet_array.length;i++){
    var bullet = bullet_array[i];
    bullet.x += bullet.speed_x; 
    bullet.y += bullet.speed_y; 
    
    // Check if this bullet is close enough to hit any player 
    for(var id in players){
      if(bullet.owner_id != id){
        var dx = players[id].x - bullet.x; 
        var dy = players[id].y - bullet.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if(dist<50){
          players[id].taken_damage++;
          if(players[id].taken_damage > 100){
            players[id].damage=0;
            players[id].taken_damage=0;
            bullet_array = [];
            io.emit('player-dead',players[id].nickname); 
          }
            
          players[bullet.owner_id].damage++;
          io.emit('update-players',players);
          io.emit('player-hit',id); // Tell everyone this player got hit
        }
      }
    }

    if(bullet.x < -10 || bullet.x > WINDOW_WIDTH || bullet.y < -10 || bullet.y > WINDOW_HEIGHT){
        bullet_array.splice(i,1);
        i--;
    }
  }
  
  io.emit("bullets-update",bullet_array);
}

setInterval(ServerGameLoop, 16); 