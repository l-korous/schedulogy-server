var {Application} = require('stick');

var app = exports.app = new Application();
app.configure('route');

app.get('/', function(request) {
    // Add the Jena library to the classpath
addToClasspath("../cpsolver/dist/cpsolver-1.3-SNAPSHOT.jar");

// Import a whole package from the loaded library
importPackage(org.cpsolver.ifs.example.tt);

var test = new Test;

var asdf = test.calculate();

   return {
      body: [asdf],
      headers: {'Content-Type': 'text/html'},
      status: 200
   };
});

if (require.main == module) {
   require('ringo/httpserver').main(module.id);
}