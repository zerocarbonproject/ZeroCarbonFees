pragma solidity ^0.4.23;

/**
 * @title PeriodUtil
 * 
 * Interface used for Period calculation to allow better automated testing of Fees Contract
 *
 * (c) Philip Louw / Zero Carbon Project 2018. The MIT Licence.
 */
contract PeriodUtil {
    /**
    * @dev calculates the Period index for the given timestamp
    * @return Period count since EPOCH
    * @param timestamp The time in seconds since EPOCH (blocktime)
    */
    function getPeriodIdx(uint256 timestamp) public pure returns (uint256);
    
    /**
    * @dev Timestamp of the period start
    * @return Time in seconds since EPOCH of the Period Start
    * @param periodIdx Period Index to find the start timestamp of
    */
    function getPeriodStartTimestamp(uint256 periodIdx) public pure returns (uint256);

    /**
    * @dev Returns the Cycle count of the given Periods. A set of time creates a cycle, eg. If period is weeks the cycle can be years.
    * @return The Cycle Index
    * @param timestamp The time in seconds since EPOCH (blocktime)
    */
    function getPeriodCycle(uint256 timestamp) public pure returns (uint256);

    /**
    * @dev Amount of Tokens per time unit since the start of the given periodIdx
    * @return Tokens per Time Unit from the given periodIdx start till now
    * @param tokens Total amount of tokens from periodIdx start till now (blocktime)
    * @param periodIdx Period IDX to use for time start
    */
    function getRatePerTimeUnits(uint256 tokens, uint256 periodIdx) public view returns (uint256);

    /**
    * @dev Amount of time units in each Period, for exampe if units is hour and period is week it will be 168
    * @return Amount of time units per period
    */
    function getUnitsPerPeriod() public pure returns (uint256);
}