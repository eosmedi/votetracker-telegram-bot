
var files = ["6vz3.log","teuu.log","9fyn.log","_n9f.log","b_le.log","78JZ.log","ev7y.log","v2n1.log","wJdR.log","T4Op.log","FWj8.log","LwD8.log","ICgD.log","Jein.log","moD5.log","0D-3.log","hUFX.log","9XwF.log","wOr7.log","5alY.log","AKsB.log","VagB.log","9emq.log","9YH2.log","BWgA.log","D9QM.log","xYGm.log","b1QE.log","_oIO.log","YJQJ.log","Tz_r.log","xSn_.log","9UNc.log","NQED.log","ldT0.log","Or1a.log","BUEK.log","kGtV.log","YMOh.log","UL3z.log","Gr5f.log","qv6j.log","cD0N.log","2hap.log","yn38.log","ryus.log","VdSh.log","GoKp.log","ZRQF.log","Wlb-.log","gOtU.log","9Vb_.log","9cEG.log","BagE.log","qr73.log","T6oH.log","haha.log","iqoA.log","cNQJ.log","1T9W.log","AEAI.log","QGoP.log"].reverse();


var execSync = require('child_process').execSync;
var fs = require('fs');

(async () =>{


    for (let index = 0; index < files.length; index++) {
        try{
            const file = files[index];
            var filePath = '/home/ubuntu/.forever/'+file;
            var points = execSync('cat -n '+filePath+' | grep producer:');
            var content = points.toString();
            var lines = content.split("\n");

            for (let b = 0; b < lines.length; b++) {
                const line = lines[b];
                var startID = line.split("\t")[0].trim();
                var comd = 'cat '+filePath+' | tail -n +'+startID+' | head -n 150';
                console.log(comd);
                var realContent = execSync(comd);
                var data = realContent.toString();
                var dataPieces = data.split("\n");
                var jsonStr = '';   

                for (let k = 0; k < dataPieces.length; k++) {
                    var dataPiece = dataPieces[k];
                    jsonStr += dataPiece+"\n";
                    if(dataPiece.indexOf('} } }') > -1){
                        console.log(jsonStr);
                        fs.appendFileSync('/home/ubuntu/logs.log', jsonStr+"\n,");
                        break;
                    }
                }
            }
        }catch(e){
            console.log(e);
        }
    }

})();