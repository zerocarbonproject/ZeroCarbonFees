pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/BasicToken.sol";

contract TokenMock is BasicToken {

    constructor (address initialAccount, uint256 initialBalance) public {
        balances[initialAccount] = initialBalance;
        totalSupply_ = initialBalance;
    }
}