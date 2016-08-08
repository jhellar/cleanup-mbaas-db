var MongoClient = require('mongodb').MongoClient;
var fh = require('fh-fhc');
var winston = require('winston');
var _ = require('underscore');
var async = require('async');

if (process.argv.length < 9) {
  return console.log('Usage: node cleanup-mbaas-db.js host username password mongoUrl mongoUsername mongoPassword domainPrefix');
}

var host = process.argv[2];
var username = process.argv[3];
var password = process.argv[4];

var mongoUrl = process.argv[5];
var mongoUsername = process.argv[6];
var mongoPassword = process.argv[7];

var domainPrefix = process.argv[8];

var url = 'mongodb://' + mongoUsername + ':' + mongoPassword + '@' + mongoUrl;

var fhConfig = {
  loglevel: 'error',
  json: true,
  feedhenry: host,
  user: username,
  inmemoryconfig: true
};

fh.load(fhConfig, function(err) {
  if (err) {
    return winston.error(err);
  }

  fh.target({_:[host]}, function(err) {
    if (err) {
      return winston.error(err);
    }

    fh.login({_:[username, password]}, function(err) {
      if (err) {
        return winston.error(err);
      }

      fh.admin.environments.list({}, function(err, environments) {
        if (err) {
          return winston.error(err);
        }

        var ids = _.pluck(environments, 'id');

        MongoClient.connect(url, function(err, db) {
          if (err) {
            winston.error('Error connecting to server'
            winston.error(err);
            db.close();
            return;
          }

          db.admin().listDatabases(function(err, dbs) {
            if (err) {
              winston.error('Error listing dbs');
              winston.error(err);
              db.close();
              return;
            }

            var testingDbs = _.pluck(dbs.databases, 'name').filter(function(dbName) {
              return dbName.startsWith(domainPrefix);
            });
            var toRemove = _.filter(testingDbs, function(dbName) {
              var name = dbName.substring(domainPrefix.length);
              return !_.contains(ids, name);
            });

            async.eachSeries(toRemove, function(dbName, callback) {
              winston.info('Removing ' + dbName);

              var dbToDrop = db.db(dbName);

              dbToDrop.dropDatabase(function(err, result) {
                if (err) {
                  winston.error(err);
                } else {
                  winston.info('Db dropped: ' + result);
                }

                callback();
              });
            }, function() {
              db.close();
            });
          });
        });
      });
    });
  });
});
