pragma solidity ^0.4.15;

import './zeppelin/lifecycle/Destructible.sol';
import './zeppelin/ownership/Ownable.sol';
import './zeppelin/math/SafeMath.sol';
import './DNTXToken.sol';

contract DNTXCrowdsale is Ownable, Destructible {
    using SafeMath for uint256;
    
    uint8 private constant PERCENT_DIVIDER = 100;              

    event SpecialMint(address beneficiary, uint256 amount, string description);

    enum State { NotStarted, PreICO, ICO, Finished }
    State public state;         //Current contract state                     

    struct ICOBonus {
        uint32 expire;       //timestamp of date when this bonus expires (purshases before this time will use the bonus)
        uint8 percent;
    }
    ICOBonus[] public icoBonuses;    //Array of ICO bonuses

    uint256 public baseRate;           //how many DNTX one will get for 1 ETH during main sale without bonus
    uint8   public preICOBonusPercent; //Pre-ICO bonus percent
    uint32  public icoStartTimestamp;  //timestamp of ICO start
    uint32  public icoEndTimestamp;    //timestamp of ICO end
    uint256 public icoGoal;            //How much ether we need to collect to assume ICO is successfull
    uint256 public hardCap;            //Max amount possibly collected

    DNTXToken public token;                                 

    uint256 public icoCollected;
    uint256 public totalCollected;
    mapping(address => uint256) public icoContributions; //amount of ether received from an investor during ICO

    function DNTXCrowdsale() public{
        state = State.NotStarted;
        token = new DNTXToken();
        token.init(owner);
    }   

    function() public payable {
        require(msg.value > 0);
        require(isOpen());

        totalCollected = totalCollected.add(msg.value);
        if(state == State.ICO){
            require(totalCollected <= hardCap);
            icoCollected = icoCollected.add(msg.value);
            icoContributions[msg.sender] = icoContributions[msg.sender].add(msg.value);
        }

        uint256 rate = currentRate();
        assert(rate > 0);

        uint256 amount = rate.mul(msg.value);
        assert(token.mint(msg.sender, amount));
    }

    function mintTokens(address beneficiary, uint256 amount, string description) onlyOwner public {
        assert(token.mint(beneficiary, amount));
        SpecialMint(beneficiary, amount, description);
    }


    function isOpen() view public returns(bool){
        if(baseRate == 0) return false;
        if(state == State.NotStarted || state == State.Finished) return false;
        if(state == State.PreICO) return true;
        if(state == State.ICO){
            if(totalCollected >= hardCap) return false;
            return (icoStartTimestamp <= now) && (now <= icoEndTimestamp);
        }
    }
    function currentRate() view public returns(uint256){
        if(state == State.PreICO) {
            return baseRate.add( baseRate.mul(preICOBonusPercent).div(PERCENT_DIVIDER) );
        }else if(state == State.ICO){
            for(uint8 i=0; i < icoBonuses.length; i++){
                ICOBonus storage b = icoBonuses[i];
                if(now <= b.expire){
                    return baseRate.add( baseRate.mul(b.percent).div(PERCENT_DIVIDER) );
                }
            }
            return baseRate;
        }else{
            return 0;
        }
    }

    function setBaseRate(uint256 rate) onlyOwner public {
        require(state != State.ICO && state != State.Finished);
        baseRate = rate;
    }
    function setPreICOBonus(uint8 percent) onlyOwner public {
        preICOBonusPercent = percent;
    }
    function setupAndStartPreICO(uint256 rate, uint8 percent) onlyOwner external {
        setBaseRate(rate);
        setPreICOBonus(percent);
        startPreICO();
    }

    function setupICO(uint32 startTimestamp, uint32 endTimestamp, uint256 goal, uint256 cap, uint32[] expires, uint8[] percents) onlyOwner external {
        require(state != State.ICO && state != State.Finished);
        icoStartTimestamp = startTimestamp;
        icoEndTimestamp = endTimestamp;
        icoGoal = goal;
        hardCap = cap;

        require(expires.length == percents.length);
        uint32 prevExpire;
        for(uint8 i=0;  i < expires.length; i++){
            require(prevExpire < expires[i]);
            icoBonuses.push(ICOBonus({expire:expires[i], percent:percents[i]}));
            prevExpire = expires[i];
        }
    }

    /**
    * @notice Start PreICO stage
    */
    function startPreICO() onlyOwner public {
        require(state == State.NotStarted);
        require(baseRate != 0);
        state = State.PreICO;
    }
    /**
    * @notice Finish PreICO stage and start ICO (after time comes)
    */
    function finishPreICO() onlyOwner external {
        require(state == State.PreICO);
        require(icoStartTimestamp != 0 && icoEndTimestamp != 0);
        state = State.ICO;
    }
    /**
    * @notice Close crowdsale, finish minting (allowing token transfers), transfers token ownership to the founder
    */
    function finalizeCrowdsale() onlyOwner external {
        state = State.Finished;
        token.finishMinting();
        token.transferOwnership(owner);
        if(icoCollected >= icoGoal && this.balance > 0) {
            claimEther();
        }
    }
    /**
    * @notice Claim collected ether without closing crowdsale
    */
    function claimEther() onlyOwner public {
        require(state == State.PreICO || icoCollected >= icoGoal);
        require(this.balance > 0);
        owner.transfer(this.balance);
    }

    /**
    * @notice Sends all contributed ether back if minimum cap is not reached by the end of crowdsale
    */
    function refund() public returns(bool){
        return refundTo(msg.sender);
    }
    function refundTo(address beneficiary) public returns(bool) {
        require(icoCollected < icoGoal);
        require(icoContributions[beneficiary] > 0);
        require( (state == State.Finished) || (state == State.ICO && (now > icoEndTimestamp)) );

        uint256 _refund = icoContributions[beneficiary];
        icoContributions[beneficiary] = 0;
        beneficiary.transfer(_refund);
        return true;
    }

}