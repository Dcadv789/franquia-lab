(function(root){
  'use strict';
  const defaults={name:'Nova franquia',city:'São Paulo, SP',format:'Minimercado autônomo',example:false,source:'',notes:'',checked:[],analysisMode:'margin',advertisedMargin:0,royaltiesIncluded:'yes',marginExtra:0,investmentStatus:'complete',contractMonths:0,revenueLow:0,revenueHigh:0,investmentMode:'items',investmentTotal:0,fee:0,setup:0,equipment:0,stock:0,preopen:0,working:0,contingency:0,revenue:0,ticket:20,salesDay:30,days:30,revenueMode:'direct',ramp:1,start:100,growth:0,inflation:0,cmv:65,tax:6,payment:2,loss:2,condo:0,royalty:0,royaltyFixed:0,royaltyMode:'percent',royaltyBase:'revenue',marketing:0,marketingFixed:0,rent:0,payroll:0,owner:0,utilities:0,software:0,accounting:0,logistics:0,maintenance:0,other:0,extra:[],loan:0,interest:18,term:24};
  const scenarios={pessimistic:{label:'Conservador',factor:.8,marginDelta:-3},base:{label:'Base',factor:1,marginDelta:0},optimistic:{label:'Otimista',factor:1.2,marginDelta:3}};
  const initialKeys=['fee','setup','equipment','stock','preopen'];
  const fixedKeys=['rent','payroll','owner','utilities','software','accounting','logistics','other'];
  const sum=(arr)=>arr.reduce((a,b)=>a+b,0);
  Object.assign(defaults,{openingDelay:0,preopeningMonthly:0,preopeningInvestments:[],businessType:'franchise',purchases:[]});
  const purchaseCategories={fee:'Taxa / direitos',setup:'Obra / montagem',equipment:'Equipamentos',stock:'Estoque',preopen:'Licenças / pré-abertura',working:'Reserva de giro',other:'Outros'};
  function make(p={}) {return {...defaults,...p,id:p.id||crypto.randomUUID(),extra:p.extra||[],checked:p.checked||[],preopeningInvestments:p.preopeningInvestments||[],purchases:p.purchases||[]};}
  function hydrate(p){return make({...p,analysisMode:p.analysisMode||'detailed'});}
  function purchaseTotal(x){return x.quantity*x.unitPrice;}
  function workingCapital(p){return p.investmentMode==='list'?sum(p.purchases.filter(x=>x.category==='working').map(purchaseTotal)):p.working;}
  function investment(p){if(p.investmentMode==='total')return p.investmentTotal;const base=p.investmentMode==='list'?sum(p.purchases.filter(x=>x.category!=='working').map(purchaseTotal)):sum(initialKeys.map(k=>p[k]));return base*(1+p.contingency/100)+workingCapital(p);}
  function itemize(p){
    if(p.purchases.length)return p.purchases.map(x=>({...x}));
    if(p.investmentMode==='total')return [
      ...(p.investmentTotal>p.working?[{name:'Pacote informado (sem o giro)',category:'other',quantity:1,unitPrice:(p.investmentTotal-p.working)/(1+p.contingency/100),notes:'Valor-base convertido do total fechado; contingência mantida separada.'}]:[]),
      ...(p.working>0?[{name:'Reserva de giro',category:'working',quantity:1,unitPrice:p.working,notes:''}]:[])
    ];
    return [...initialKeys,'working'].filter(k=>p[k]>0).map(k=>({name:purchaseCategories[k],category:k,quantity:1,unitPrice:p[k],notes:'Valor trazido do orçamento por categoria. Detalhe as compras sem repetir este total.'}));
  }
  function preopeningAt(p,m){return m>=1&&m<=p.openingDelay?p.preopeningMonthly+sum(p.preopeningInvestments.filter(x=>x.month===m).map(x=>x.amount)):0;}
  function preopeningInvestment(p){return p.openingDelay*p.preopeningMonthly+sum(p.preopeningInvestments.map(x=>x.amount));}
  function revenue(p){return p.revenueMode==='ticket'?p.ticket*p.salesDay*p.days:p.revenue;}
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function scenarioParams(settings={},key=settings.scenario||'base'){
    const s=scenarios[key]||scenarios.base,v=settings.scenarioValues?.[key];
    return {factor:v?1+v.revenue/100:s.factor,marginDelta:v?v.margin:s.marginDelta};
  }
  function royaltyAmount(p,r,cmv=r*p.cmv/100){
    if(p.businessType==='independent')return 0;
    const rp=(p.royaltyBase==='cmv'?cmv:r)*p.royalty/100;
    return p.royaltyMode==='fixed'?p.royaltyFixed:p.royaltyMode==='minimum'?Math.max(rp,p.royaltyFixed):rp;
  }
  function costs(p,r,m=1,marginDelta=0){
    if(p.analysisMode==='margin'){
      const scenarioMargin=clamp(p.advertisedMargin+marginDelta,-100,100),reportedProfit=r*scenarioMargin/100;
      const royaltyReference=royaltyAmount({...p,royaltyBase:'revenue'},r);
      const royalties=p.royaltiesIncluded==='yes'?0:royaltyReference;
      const impliedCosts=r-reportedProfit;
      return {cmv:0,tax:0,payment:0,loss:0,condo:0,royalties,royaltyReference,marketing:0,fixed:p.marginExtra,extras:0,reportedProfit,scenarioMargin,impliedCosts,total:impliedCosts+royalties+p.marginExtra};
    }
    const inf=Math.pow(1+p.inflation/100,(m-1)/12);
    const cmv=r*clamp(p.cmv-marginDelta,0,100)/100;
    const royalties=royaltyAmount(p,r,cmv);
    const fixed=sum(fixedKeys.map(k=>p[k]))*inf;
    const extras=sum(p.extra.map(x=>x.type==='percent'?r*x.value/100:x.value*inf));
    const marketing=r*p.marketing/100+p.marketingFixed;
    const tax=r*p.tax/100,payment=r*p.payment/100,loss=r*p.loss/100,condo=r*p.condo/100;
    return {cmv,tax,payment,loss,condo,royalties,marketing,fixed,extras,total:cmv+tax+payment+loss+condo+royalties+marketing+fixed+extras};
  }
  function breakEven(p,m=1,debt=0,marginDelta=0){
    if(p.analysisMode==='margin')return null;
    function net(r){return r-costs(p,r,m,marginDelta).total-p.maintenance-debt;}
    if(net(0)>=0)return 0;
    let lo=0,hi=1000;while(net(hi)<0&&hi<1e12)hi*=2;
    if(net(hi)<0)return null;
    for(let i=0;i<70;i++){let mid=(lo+hi)/2;if(net(mid)>=0)hi=mid;else lo=mid;}
    return hi;
  }
  function project(p,settings={},factorOverride){
    const horizon=settings.horizon||60,tma=settings.tma??12;
    const scenario=scenarioParams(settings);
    const factor=typeof factorOverride==='number'?factorOverride:factorOverride?.factor??scenario.factor;
    const marginDelta=typeof factorOverride==='object'?factorOverride.marginDelta??scenario.marginDelta:scenario.marginDelta;
    const initial=investment(p),preopeningTotal=preopeningInvestment(p),total=initial+preopeningTotal,loan=Math.min(p.loan,initial),initialEquity=initial-loan,equity=total-loan;
    const rate=Math.pow(1+p.interest/100,1/12)-1;
    const term=Math.max(1,p.term);
    const installment=loan===0?0:rate===0?loan/term:loan*rate/(1-Math.pow(1+rate,-term));
    const discount=Math.pow(1+tma/100,1/12)-1;
    const maintenance=p.analysisMode==='margin'?0:p.maintenance;
    let balance=loan,cumulative=-initialEquity,discounted=-initialEquity,npv=-initialEquity,liquidity=workingCapital(p),minLiquidity=workingCapital(p),payback=null,discountPayback=null,projectCumulative=-initial,projectPayback=null,profitCumulative=0,invested=initial;
    const rows=[];
    for(let m=1;m<=horizon;m++){
      const operationMonth=Math.max(0,m-p.openingDelay),preopening=operationMonth===0;
      const ramp=p.ramp<=1?1:(p.start/100+(1-p.start/100)*Math.min(1,(operationMonth-1)/(p.ramp-1)));
      const r=preopening?0:revenue(p)*factor*ramp*Math.pow(1+p.growth/100,(Math.max(0,operationMonth-p.ramp))/12);
      const c=preopening?{cmv:0,tax:0,payment:0,loss:0,condo:0,royalties:0,royaltyReference:0,marketing:0,fixed:0,extras:0,total:0}:costs(p,r,operationMonth,marginDelta);
      const additionalInvestment=preopeningAt(p,m),monthlyMaintenance=preopening?0:maintenance;
      const interest=balance*rate;
      const debt=m<=term&&balance>0?Math.min(installment,balance+interest):0;
      balance=Math.max(0,balance-(debt-interest));
      const operating=r-c.total;
      const operatingProfit=operating-monthlyMaintenance,projectCash=operatingProfit-additionalInvestment,cash=projectCash-debt;
      const pv=cash/Math.pow(1+discount,m);
      const prev=cumulative,prevD=discounted;
      cumulative+=cash;discounted+=pv;npv+=pv;liquidity+=cash+additionalInvestment;minLiquidity=Math.min(minLiquidity,liquidity);
      profitCumulative+=operatingProfit;invested+=additionalInvestment;
      if(equity>0&&payback===null&&prev<0&&cumulative>=0&&cash>0)payback=m-1+(-prev)/cash;
      if(equity>0&&discountPayback===null&&prevD<0&&discounted>=0&&pv>0)discountPayback=m-1+(-prevD)/pv;
      const prevProject=projectCumulative;projectCumulative+=projectCash;
      if(total>0&&projectPayback===null&&prevProject<0&&projectCumulative>=0&&projectCash>0)projectPayback=m-1+(-prevProject)/projectCash;
      rows.push({month:m,operationMonth,preopening:preopening?1:0,revenue:r,...c,operating,maintenance:monthlyMaintenance,operatingProfit,additionalInvestment,profitCumulative,invested,debt,interest,cash,projectCash,projectCumulative,cumulative,discounted,liquidity,balance});
    }
    const stableMonth=p.openingDelay+Math.max(1,p.ramp);
    let stable=rows[stableMonth-1];
    if(!stable){
      const r=revenue(p)*factor,c=costs(p,r,p.ramp,marginDelta),debt=stableMonth<=term?installment:0,operating=r-c.total;
      stable={month:stableMonth,operationMonth:p.ramp,revenue:r,...c,operating,maintenance,debt,operatingProfit:operating-maintenance,additionalInvestment:0,cash:operating-maintenance-debt,projectCash:operating-maintenance};
    }
    return {initial,initialEquity,preopeningTotal,total,loan,equity,installment,rows,stable,payback,projectPayback,discountPayback,npv,additional:Math.max(0,-minLiquidity),ending:cumulative,projectEnding:projectCumulative,totalProfit:profitCumulative,invested,plannedBeyondHorizon:total-invested,totalCash:sum(rows.map(r=>r.cash)),firstYearProfit:sum(rows.slice(0,12).map(r=>r.operatingProfit)),remaining:Math.max(0,-cumulative),roi:equity>0?cumulative/equity*100:null,breakEven:breakEven(p,stable.operationMonth,stable.debt,marginDelta),margin:stable.revenue>0?stable.cash/stable.revenue*100:null};
  }
  function validate(p){
    const errors=[];
    for(const [k,v] of Object.entries(defaults))if(typeof v==='number'&&(!Number.isFinite(p[k])||(p[k]<0&&!['growth','inflation'].includes(k))))errors.push(k);
    for(const k of ['contingency','start','cmv','tax','payment','loss','condo','royalty','marketing'])if(p[k]>100)errors.push(k);
    if(p.growth<=-100||p.inflation<=-100)errors.push('growth/inflation');
    if(!Number.isInteger(p.ramp)||p.ramp<1||p.ramp>120)errors.push('ramp');
    if(!Number.isInteger(p.openingDelay)||p.openingDelay>120)errors.push('openingDelay');
    if(!Array.isArray(p.preopeningInvestments)||p.preopeningInvestments.length>120||p.preopeningInvestments.some(x=>!x||typeof x.name!=='string'||x.name.length>500||!Number.isInteger(x.month)||x.month<1||x.month>p.openingDelay||!Number.isFinite(x.amount)||x.amount<0))errors.push('preopeningInvestments');
    if(!Number.isInteger(p.term)||p.term<1||p.term>360)errors.push('term');
    if(p.days>31)errors.push('days');
    if(p.growth>200||p.inflation>100||p.interest>1000)errors.push('rates');
    if(!['complete','partial'].includes(p.investmentStatus))errors.push('investmentStatus');
    if(!Number.isInteger(p.contractMonths)||p.contractMonths>600)errors.push('contractMonths');
    if(p.revenueHigh>0&&p.revenueLow>p.revenueHigh)errors.push('revenueRange');
    if(!['franchise','independent'].includes(p.businessType))errors.push('businessType');
    if(!Array.isArray(p.purchases)||p.purchases.length>200||p.purchases.some(x=>!x||typeof x.name!=='string'||x.name.length>500||typeof x.notes!=='string'||x.notes.length>2000||!Object.hasOwn(purchaseCategories,x.category)||!Number.isFinite(x.quantity)||x.quantity<0||!Number.isFinite(x.unitPrice)||x.unitPrice<0||!Number.isFinite(purchaseTotal(x))))errors.push('purchases');
    if(!errors.includes('purchases')&&p.loan>investment(p))errors.push('loan');
    if(!['margin','detailed'].includes(p.analysisMode)||!['yes','no'].includes(p.royaltiesIncluded)||!['items','total','list'].includes(p.investmentMode)||p.advertisedMargin>100)errors.push('margin/mode');
    if(p.investmentMode==='total'&&p.working>p.investmentTotal)errors.push('working');
    if(!['direct','ticket'].includes(p.revenueMode)||!['percent','fixed','minimum'].includes(p.royaltyMode)||!['cmv','revenue'].includes(p.royaltyBase))errors.push('mode');
    if(!Array.isArray(p.extra)||p.extra.length>100||p.extra.some(x=>!['fixed','percent'].includes(x.type)||!Number.isFinite(x.value)||x.value<0))errors.push('extra');
    return [...new Set(errors)];
  }
  function seeds(){return [
    make({id:'example-a',name:'Mercado Compacto',advertisedMargin:15,example:true,format:'Autônomo · 1 ponto',fee:10000,setup:4000,equipment:12000,stock:7000,preopen:1000,working:10000,contingency:10,revenue:22000,cmv:62,tax:5,royalty:5,payment:1.8,loss:2,condo:3,owner:1500,utilities:350,software:200,accounting:350,logistics:400,maintenance:100,ramp:6,start:50}),
    make({id:'example-b',name:'Mercado Essencial',advertisedMargin:18,example:true,format:'Autônomo · 1 ponto',fee:30000,setup:5000,equipment:17000,stock:10000,preopen:1500,working:15000,contingency:10,revenue:32000,cmv:60,tax:5,royalty:6.5,payment:1.8,loss:2,condo:3,owner:2000,utilities:450,software:250,accounting:350,logistics:600,maintenance:150,ramp:8,start:40}),
    make({id:'example-c',name:'Mercado de Bairro',advertisedMargin:12,example:true,format:'Loja física · 1 ponto',fee:20000,setup:30000,equipment:45000,stock:30000,preopen:5000,working:30000,contingency:10,revenue:95000,cmv:62,tax:6,royalty:3,payment:1.5,loss:2,rent:4500,payroll:6500,owner:3000,utilities:1600,accounting:500,software:350,logistics:500,maintenance:350,ramp:9,start:50})];}
  root.FranquiaModel={defaults,scenarios,make,hydrate,investment,workingCapital,purchaseCategories,purchaseTotal,itemize,preopeningAt,preopeningInvestment,revenue,costs,project,validate,seeds,scenarioParams};
  if(typeof module!=='undefined')module.exports=root.FranquiaModel;
})(typeof globalThis!=='undefined'?globalThis:this);
