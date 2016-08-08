exports.initialize = function (settings, util) {
    addToClasspath("./cpsolver/dist/cpsolver-1.3-SNAPSHOT.jar");
    addToClasspath("./cpsolver/dist/json-20090211.jar");
    addToClasspath("./cpsolver/dist/log4j-1.2.17.jar");
    addToClasspath("./cpsolver/dist/dom4j-1.6.1.jar");
    addToClasspath("./cpsolver/dist/xml-apis-1.0.b2.jar");
    importPackage(org.cpsolver.ifs.example.tt);

    exports.solve = function (problemJson) {
        var calculator = new Calculator;

        var solution = calculator.calculate(JSON.stringify(problemJson), settings.solverTimeout);

        util.cdir(solution, true);

        return solution === "" ? false : solution;
    };
};
