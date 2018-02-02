var $ = jQuery;
jQuery(document).ready(function($) {

    let web3 = null;
    let tokenContract = null;
    let crowdsaleContract = null;

    setTimeout(init, 1000);

    async function init(){
        web3 = await loadWeb3();
        if(web3 == null) {
            setTimeout(init, 5000);
            return;
        }
        loadContract('./build/contracts/DNTXToken.json', function(data){
            tokenContract = data;
            $('#tokenABI').text(JSON.stringify(data.abi));
        });
        loadContract('./build/contracts/DNTXCrowdsale.json', function(data){
            crowdsaleContract = data;
            $('#crowdsaleABI').text(JSON.stringify(data.abi));
            initManageForm();
        });
        initCrowdsaleForm();
        initSetupForm();
    }
   

    function initCrowdsaleForm(){
        setInterval(function(){$('#clock').val( (new Date()).toISOString() )}, 1000);
    }

    function initSetupForm(){
        let form = $('#manageCrowdsale');
        let d = new Date();
        let nowTimestamp = d.setMinutes(0, 0, 0);
        d = new Date(nowTimestamp+1*60*60*1000);
        $('input[name=set_startTime]', form).val(d.toISOString());
        d = new Date(nowTimestamp+(30*24 + 1)*60*60*1000);
        $('input[name=set_endTime]', form).val(d.toISOString());
        $('input[name=set_goal]', form).val(1200);
        $('input[name=set_hardCap]', form).val(28000);

        $('input[name=set_baseRate]', form).val(1000);
        $('input[name=set_preICOBonusPercent]', form).val(30);


        function addICOBonus(expire, percent){
            let tbody = $('#set_ICOBonuses tbody');
            let roundNum = $('tr', tbody).length;
            $('<tr></tr>').appendTo(tbody)
                .append('<td><input type="text" name="set_icoBonusExpire['+roundNum+']" value="'+expire+'" class="number"></td>')
                .append('</td><td><input type="text" name="set_icoBonusPercent['+roundNum+']" value="'+percent+'" class="number"></td>');
        }

        d = new Date(nowTimestamp+(  7*24 + 1)*60*60*1000);       
        addICOBonus(d.toISOString(), 10);
        d = new Date(nowTimestamp+(2*7*24 + 1)*60*60*1000);       
        addICOBonus(d.toISOString(), 15);
        d = new Date(nowTimestamp+(3*7*24 + 1)*60*60*1000);       
        addICOBonus(d.toISOString(), 10);
        d = new Date(nowTimestamp+(4*7*24 + 1)*60*60*1000);       
        addICOBonus(d.toISOString(), 5);
        
    }



    function initManageForm(){
        let crowdsaleAddress = getUrlParam('crowdsale');
        if(web3.utils.isAddress(crowdsaleAddress)){
            $('input[name=crowdsaleAddress]', '#manageCrowdsale').val(crowdsaleAddress);
            $('#loadCrowdsaleInfo').click();
            $('input[name=crowdsaleAddress]', '#publishReferralCrowdsaleForm').val(crowdsaleAddress);
            $('input[name=crowdsaleAddress]', '#distributePreICO').val(crowdsaleAddress);
        }
    }
    $('#publishCrowdsale').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#publishContractsForm');
        let args = [];
        console.log('Publishing '+crowdsaleContract.contractName+' with arguments:', args);

        let crowdsaleObj = new web3.eth.Contract(crowdsaleContract.abi);
        crowdsaleObj.deploy({
            data: crowdsaleContract.bytecode,
            arguments: args
        })
        .send({
            from: web3.eth.defaultAccount,
        })
        .on('error',function(error){
            console.log('Publishing failed: ', error);
            printError(error);
        })
        .on('transactionHash',function(tx){
            $('input[name=publishedTx]',form).val(tx);
        })
        .on('receipt',function(receipt){
            let crowdsaleAddress = receipt.contractAddress;
            $('input[name=publishedAddress]',form).val(crowdsaleAddress);
            $('input[name=crowdsaleAddress]','#manageCrowdsale').val(crowdsaleAddress);
            $('#loadCrowdsaleInfo').click();
        })
        .then(function(contractInstance){
            console.log('Contract instance', contractInstance);
            //console.log(contractInstance.options.address) // instance with the new contract address
            return contractInstance.methods.token().call()
            .then(function(result){
                $('input[name=tokenAddress]',form).val(result);
            });
        });
    });

    $('#startPreICO').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, $('input[name=crowdsaleAddress]',form).val());

        let set_baseRate  = $('input[name=set_baseRate]', form).val();
        let set_preICOBonusPercent  = $('input[name=set_preICOBonusPercent]', form).val();


        crowdsaleInstance.methods.setupAndStartPreICO(set_baseRate, set_preICOBonusPercent).send({
            from: web3.eth.defaultAccount,
        })
        .on('transactionHash', function(tx){
            console.log('StartPreICO tx:', tx);
            $('#loadCrowdsaleInfo').click();
        })
        .on('error',function(error){
            console.log('StartPreICO failed: ', error);
            printError(error);
        })
        .on('receipt',function(receipt){
            $('#loadCrowdsaleInfo').click();
        });

    });

    $('#setupICO').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;

        let startTimestamp = timeStringToTimestamp($('input[name=set_startTime]', form).val());
        let endTimestamp  = timeStringToTimestamp($('input[name=set_endTime]', form).val());
        let goal  = web3.utils.toWei($('input[name=set_goal]', form).val(), 'ether');
        let hardCap  = web3.utils.toWei($('input[name=set_hardCap]', form).val(), 'ether');

         
        let icoBonusTable = $('#set_ICOBonuses');
        let icoBonusLength = $('tbody tr', icoBonusTable).length;
        let icoBonusExpires = new Array();
        let icoBonusPercents = new Array();
        for(let i = 0; i < icoBonusLength; i++){
            icoBonusExpires[i] = timeStringToTimestamp($('input[name=set_icoBonusExpire\\['+i+'\\]]', icoBonusTable).val());
            icoBonusPercents[i] = $('input[name=set_icoBonusPercent\\['+i+'\\]]', icoBonusTable).val()
        }

        let args = [startTimestamp, endTimestamp, goal, hardCap, icoBonusExpires, icoBonusPercents];
        console.log('Set up '+crowdsaleContract.contractName+' with arguments:', args);

        crowdsaleInstance.methods.setupICO(
            startTimestamp, endTimestamp, goal, hardCap, icoBonusExpires, icoBonusPercents
        ).send({
            from: web3.eth.defaultAccount,
        })
        .on('error',function(error){
            console.log('Setup failed: ', error);
            printError(error);
        })
        .on('transactionHash',function(tx){
            console.log('Setup tx:', tx);
            $('#loadCrowdsaleInfo').click();
        })
        .on('receipt',function(receipt){
            $('#loadCrowdsaleInfo').click();
        });
    });


    $('#loadCrowdsaleInfo').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;
        //console.log(crowdsaleInstance.methods);
        crowdsaleInstance.methods.token().call()
        .then(function(result){
            $('input[name=tokenAddress]',form).val(result);
            return result;
        });
        web3.eth.getBalance(crowdsaleAddress).then(function(result){
            $('input[name=balance]',form).val(web3.utils.fromWei(result));
        });
        crowdsaleInstance.methods.isOpen().call().then(function(result){
            $('input[name=open]',form).val(result?'yes':'no');
        });
        crowdsaleInstance.methods.baseRate().call().then(function(result){
            $('input[name=baseRate]',form).val(result);
        });
        crowdsaleInstance.methods.currentRate().call().then(function(result){
            $('input[name=currentRate]',form).val(result);
        });
        crowdsaleInstance.methods.state().call().then(function(result){
            let state;
            switch(Number(result)){
                case 0: state = 'NotStarted'; break;
                case 1: state = 'PreICO';  break;
                case 2: state = 'ICO'; break;
                case 3: state = 'Finished'; break;
                default:
                    state = 'Umknown'+result; 
            }
            $('input[name=currentState]',form).val(state);
        });
        crowdsaleInstance.methods.icoStartTimestamp().call().then(function(result){
            $('input[name=startTime]',form).val(result==0?'':timestmapToString(result));
        });
        crowdsaleInstance.methods.icoEndTimestamp().call().then(function(result){
            $('input[name=endTime]',form).val(result==0?'':timestmapToString(result));
        });
        crowdsaleInstance.methods.icoGoal().call().then(function(result){
            $('input[name=goal]',form).val(web3.utils.fromWei(result));
        });
        crowdsaleInstance.methods.icoCollected().call().then(function(result){
            $('input[name=icoCollected]',form).val(web3.utils.fromWei(result));
        });
        crowdsaleInstance.methods.totalCollected().call().then(function(result){
            $('input[name=totalCollected]',form).val(web3.utils.fromWei(result));
        });
        crowdsaleInstance.methods.hardCap().call().then(function(result){
            $('input[name=hardCap]',form).val(web3.utils.fromWei(result));
        });
        web3.eth.getBalance(crowdsaleAddress).then(function(result){
            $('input[name=balance]',form).val(web3.utils.fromWei(result));
        });

        let tbody = $('#ICOBonuses tbody');
        tbody.empty();
        function loadICOBonuses(row){
            return $.Deferred(function(def){
                crowdsaleInstance.methods.icoBonuses(row).call().then(function(result){
                    $('<tr></tr>').appendTo(tbody)
                        .append('<td><input type="text" readonly name=icoBonusExpire['+row+']" value="'+timestmapToString(result.expire)+'" class="time"></td>')
                        .append('<td><input type="number" readonly name="set_icoBonusPercent['+row+']" value="'+result.percent+'" class="number"></td>')
                    def.resolve();
                });
            }).promise();
        }
        loadICOBonuses(0)
        .then(loadICOBonuses(1))
        .then(loadICOBonuses(2))
        .then(loadICOBonuses(3));


    });
    $('#startICO').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;

        crowdsaleInstance.methods.finishPreICO().send({
            from: web3.eth.defaultAccount,
        })
        .on('transactionHash', function(hash){
            console.log('FinishPreICO transaction tx: '+hash);
        })
        .on('receipt',function(receipt){
            $('#loadCrowdsaleInfo').click();
        });
    });

    $('#crowdsaleClaim').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;

        crowdsaleInstance.methods.claimEther().send({
            from: web3.eth.defaultAccount,
        })
        .on('transactionHash', function(hash){
            console.log('Claim transaction tx: '+hash);
        })
        .on('receipt',function(receipt){
            $('#loadCrowdsaleInfo').click();
        });
    });

    $('#crowdsaleFinalize').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');

        let crowdsaleAddress = $('input[name=crowdsaleAddress]',form).val();
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, crowdsaleAddress);
        if(crowdsaleInstance == null) return;

        crowdsaleInstance.methods.finalizeCrowdsale().send({
            from: web3.eth.defaultAccount,
        })
        .on('transactionHash', function(hash){
            console.log('Finalize transaction tx: '+hash);
        })
        .on('receipt',function(receipt){
            $('#loadCrowdsaleInfo').click();
        });
    });

    $('#specialMint').click(function(){
        if(crowdsaleContract == null) return;
        printError('');
        let form = $('#manageCrowdsale');
        let crowdsaleInstance = loadContractInstance(crowdsaleContract, $('input[name=crowdsaleAddress]',form).val());

        let beneficiary  = $('input[name=beneficiary]', form).val();
        if(!web3.utils.isAddress(beneficiary)){printError('Beneficiary address is not an Ethereum address'); return;}
        let amount  = web3.utils.toWei($('input[name=amount]', form).val(), 'ether');
        let description  = $('input[name=description]', form).val();


        crowdsaleInstance.methods.mintTokens(beneficiary, amount, description).send({
            from: web3.eth.defaultAccount,
        })
        .on('transactionHash', function(tx){
            console.log('SpecialMint tx:', tx);
            $('#loadCrowdsaleInfo').click();
        })
        .on('error',function(error){
            console.log('SpecialMint failed: ', error);
            printError(error);
        });
    });



    //====================================================

    async function loadWeb3(){
        printError('');
        if(typeof window.web3 == "undefined"){
            printError('No MetaMask found');
            return null;
        }
        // let Web3 = require('web3');
        // let web3 = new Web3();
        // web3.setProvider(window.web3.currentProvider);
        let web3 = new Web3(window.web3.currentProvider);

        let accounts = await web3.eth.getAccounts();
        if(typeof accounts[0] == 'undefined'){
            printError('Please, unlock MetaMask');
            return null;
        }
        // web3.eth.getBlock('latest', function(error, result){
        //     console.log('Current latest block: #'+result.number+' '+timestmapToString(result.timestamp), result);
        // });
        web3.eth.defaultAccount =  accounts[0];
        window.web3 = web3;
        return web3;
    }
    function loadContract(url, callback){
        $.ajax(url,{'dataType':'json', 'cache':'false', 'data':{'t':Date.now()}}).done(callback);
    }

    function loadContractInstance(contractDef, address){
        if(typeof contractDef == 'undefined' || contractDef == null) return null;
        if(!web3.utils.isAddress(address)){printError('Contract '+contractDef.contract_name+' address '+address+'is not an Ethereum address'); return null;}
        return new web3.eth.Contract(contractDef.abi, address);
    }

    function timeStringToTimestamp(str){
        return Math.round(Date.parse(str)/1000);
    }
    function timestmapToString(timestamp){
        return (new Date(timestamp*1000)).toISOString();
    }

    /**
    * Take GET parameter from current page URL
    */
    function getUrlParam(name){
        if(window.location.search == '') return null;
        let params = window.location.search.substr(1).split('&').map(function(item){return item.split("=").map(decodeURIComponent);});
        let found = params.find(function(item){return item[0] == name});
        return (typeof found == "undefined")?null:found[1];
    }

    function parseCSV(data){
        data = data.replace(/\t/g, ' ');
        let lineSeparator = '\n';
        let columnSeparator = ' ';
        let csv = data.trim().split(lineSeparator).map(function(line){
            return line.trim().split(columnSeparator).map(function(elem){
                return elem.trim();
            });
        });
        return csv;
    }
    function htmlEntities(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function printError(msg){
        if(msg == null || msg == ''){
            $('#errormsg').html('');    
        }else{
            console.error(msg);
            $('#errormsg').html(msg);
        }
    }
});
