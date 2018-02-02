pragma solidity ^0.4.15;

import './zeppelin/token/MintableToken.sol';
import './zeppelin/ownership/HasNoContracts.sol';
import './zeppelin/ownership/HasNoTokens.sol';
import './BurnableToken.sol';

contract DNTXToken is BurnableToken, MintableToken, HasNoContracts, HasNoTokens {
    string public symbol = 'DNTX';
    string public name = 'Dentix';
    uint8 public constant decimals = 18;

    address founder;    //founder address to allow him transfer tokens while minting
    function init(address _founder) onlyOwner public{
        founder = _founder;
    }

    /**
     * Allow transfer only after crowdsale finished
     */
    modifier canTransfer() {
        require(mintingFinished || msg.sender == founder);
        _;
    }
    
    function transfer(address _to, uint256 _value) canTransfer public returns (bool) {
        return BurnableToken.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) canTransfer public returns (bool) {
        return BurnableToken.transferFrom(_from, _to, _value);
    }
}

