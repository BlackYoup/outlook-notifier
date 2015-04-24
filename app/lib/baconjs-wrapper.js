let timers = require('sdk/timers');
let Bacon = require('./vendor/bacon.js/dist/Bacon.min.js');

Bacon.scheduler.setTimeout = (f, d) => timers.setTimeout(f, d);
Bacon.scheduler.setInterval = (f, i) => timers.setInterval(f, i);
Bacon.scheduler.clearInterval = id => timers.clearInterval(id);
Bacon.scheduler.clearTimeout = id => timers.clearInterval(id);

module.exports = Bacon;
