// scp-medication server component
// Registers additional Express routes so that scp-vital, scp-symptom, and
// scp-visit type items also load from this same JS file.
// wiki-server calls startServer({argv, app}) for each installed plugin.

var path = require('path');
var clientFile = path.join(__dirname, '..', 'client', 'scp-medication.js');
var aliasTypes = [
  'scp-vital', 'scp-symptom', 'scp-visit',
  'scp-about', 'scp-provider', 'scp-diagnosis', 'scp-reaction',
  'scp-history', 'scp-next-step', 'scp-directive', 'scp-access',
  'scp-controls', 'scp-previsit', 'scp-log-entry', 'scp-care-member', 'scp-vital-chart',
  'scp-factory'
];

module.exports = {
  startServer: function (params) {
    var app = params.app;
    aliasTypes.forEach(function (type) {
      app.get('/plugins/' + type + '/' + type + '.js', function (req, res) {
        res.sendFile(clientFile);
      });
      app.get('/plugins/' + type + '.js', function (req, res) {
        res.sendFile(clientFile);
      });
    });
  }
};
