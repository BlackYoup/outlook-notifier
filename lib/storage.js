var storage = require('sdk/simple-storage').storage;

function Storage(){
  this.get = function(key){
    return storage[key];
  };

  this.set = function(key, value){
    storage[key] = value;
  };

  this.delete = function(key){
    delete storage[key];
  };
}

module.exports = new Storage();
