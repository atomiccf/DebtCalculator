
const btn = document.querySelector('#render');
const body = document.querySelector('body')
const app = document.getElementById('app');

btn.addEventListener('click',render)



function render (){
    const container = document.createElement('div');
    const labelDebt = document.createElement('label');
    const inputDebt = document.createElement('input');
    const labelDateOne = document.createElement('label');
    const inputDateOne = document.createElement('input');
    const labelDateSec = document.createElement('label');
    const inputDateSec = document.createElement('input');
    const divCalc = document.createElement('div');
    const divOut = document.createElement('div');
    const divOutOne = document.createElement('div');
    const divOutSecond = document.createElement('div');
    const divOutThree = document.createElement('div');
    const br = document.createElement('br');
    const br1 = document.createElement('br');
    const br2 = document.createElement('br');

    app.appendChild(container);
    container.classList.add('flex_container');
    container.appendChild(divCalc);
    divCalc.classList.add('value_block');
    divCalc.prepend(labelDebt);
    labelDebt.setAttribute('for','debt');
    labelDebt.innerText = 'Долг по ТТН';
    divCalc.appendChild(inputDebt);
    inputDebt.setAttribute('type','text');
    inputDebt.setAttribute('inputmode','decimal');
    inputDebt.setAttribute('id','debt');
    inputDebt.classList.add('debt');
    inputDebt.after(br);

    divCalc.appendChild(labelDateOne);
    labelDateOne.setAttribute('for','dateOne');
    labelDateOne.innerText = 'Начало периода';
    divCalc.appendChild(inputDateOne);
    inputDateOne.setAttribute('type','date');
    inputDateOne.classList.add('dateOne');
    inputDateOne.after(br1);

    divCalc.appendChild(labelDateSec);
    labelDateSec.setAttribute('for','dateTwo');
    labelDateSec.innerText = 'Конец периода';
    divCalc.appendChild(inputDateSec);
    inputDateSec.setAttribute('type','date');
    inputDateSec.classList.add('dateTwo');
    inputDateSec.after(br2);

    container.appendChild(divOut);
    divOut.appendChild(divOutOne);
    divOutOne.classList.add('out1');
    divOut.appendChild(divOutSecond);
    divOutSecond.classList.add('out2');
    divOut.appendChild(divOutThree);
    divOutThree.classList.add('out3');


    addScript()


}




function addScript() {
    const script = document.createElement('script')
    let before = document.querySelector('#before');

    body.insertBefore(script,before)
    script.setAttribute('src','script2.js')
    addScript = () => {};

}




