exports.solve = function (input) {
    addToClasspath("../cpsolver/dist/cpsolver-1.3-SNAPSHOT.jar");

    importPackage(org.cpsolver.ifs.example.tt);

    var calculator = new Calculator;

    var solution = calculator.calculate();

    return solution;
};