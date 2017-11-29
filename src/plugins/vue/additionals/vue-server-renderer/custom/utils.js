module.exports.makeMap = function makeMap ( str, expectsLowerCase ) {
  var map = Object.create(null);
  var list = str.split(',');
  for (var i = 0; i < list.length; i++) {
    map[list[i]] = true;
  }
  return expectsLowerCase
    ? function (val) { return map[val.toLowerCase()]; }
    : function (val) { return map[val]; }
}

module.exports.extend = function extend (to, _from) {
    for (var key in _from) {
        to[key] = _from[key];
    }
    return to
}