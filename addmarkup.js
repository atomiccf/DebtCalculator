
const app = document.getElementById('app');
const body = document.querySelector('body')

renderControlPanel()

const btn = document.querySelector('#render');
btn.addEventListener('click',renderBlock)
function renderBlock (){
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

function renderControlPanel() {
    const containerPanel = document.createElement('div');
    const buttonAdd = document.createElement('button');
    const buttonDel = document.createElement('button');
    const buttonCalc = document.createElement('button');
    const h2 = document.createElement('h2');

    app.prepend(containerPanel);
    containerPanel.classList.add('container');
    containerPanel.appendChild(buttonAdd);
    containerPanel.prepend(h2)
    h2.innerText = 'Calculation of penalties for an arbitration claim'
    buttonAdd.classList.add('button');
    buttonAdd.setAttribute('id','render');
    buttonAdd.innerText='Add block';
    containerPanel.appendChild(buttonDel);
    buttonDel.classList.add('button');
    buttonDel.setAttribute('id','delete');
    buttonDel.innerText='Delete block';
    containerPanel.appendChild(buttonCalc)
    buttonCalc.classList.add('button')
    buttonCalc.setAttribute('id','calc');
    buttonCalc.innerText='Calculate'

}

function addScript() {
    const script = document.createElement('script')
    let before = document.querySelector('#before');

    body.insertBefore(script,before)
    script.setAttribute('src','script2.js')
    addScript = () => {};

}




