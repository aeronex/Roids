// shim
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

// connect
var socket = io.connect();
var dirtyPlayers = false;
var data = {players: {}};

var context = a.getContext('2d');
context.fillStyle = '#333';

socket.on('message', function (newData) {
  dirtyPlayers = !!newData;
  newData && newData.forEach(function (datum) {
    setPath(datum.key, datum.value, data);
  });
});

function setPath (path, value, obj) {
  path = path.split('.');
  var segment;
  while (path.length > 1 && (segment = path.shift())) {
    obj = obj[segment] || (obj[segment] = {});
  }
  obj[path[0]] = value;
}

function render () {
  renderPlayers();
  // for canvases
  requestAnimationFrame(render);
}

function renderPlayers () {
  if (dirtyPlayers) {
    a.width = a.width;
    dirtyPlayers = false;
    var players = Object.keys(data.players).forEach(function (id) {
      var player = data.players[id];
      context.fillRect(player.x, player.y, 10, 10);
    });
  }
}

render();
