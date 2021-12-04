declare module 'big-number' {
    class BigNumber {
      constructor(i: number | BigNumber);
  
      plus(i: number | BigNumber): BigNumber;
      add(i: number | BigNumber): BigNumber;
  
      minus(i: number | BigNumber): BigNumber;
      subtract(i: number | BigNumber): BigNumber;
  
      multiply(i: number | BigNumber): BigNumber;
      mult(i: number | BigNumber): BigNumber;
  
      divide(i: number | BigNumber): BigNumber;
      div(i: number | BigNumber): BigNumber;
  
      power(i: number | BigNumber): BigNumber;
      pow(i: number | BigNumber): BigNumber;
  
      mod(i: number | BigNumber): BigNumber;
  
      equals(i: number | BigNumber): BigNumber;
      lt(i: number | BigNumber): BigNumber;
      lte(i: number | BigNumber): BigNumber;
      gt(i: number | BigNumber): BigNumber;
      gte(i: number | BigNumber): BigNumber;
      isZero(i: number | BigNumber): BigNumber;
      abs(i: number | BigNumber): BigNumber;
    }
  
    export default BigNumber;
  }
  