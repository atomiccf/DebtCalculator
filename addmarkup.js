const a = document.querySelectorAll('[type="date"]')
const btn = document.querySelector('#render');
const body = document.querySelector('body')
btn.addEventListener('click',render)

let arr = []
let count = 0


function render (){
    arr.push(++count)
    let result = ''
    arr.forEach(elem =>{
        result+= `
   <div class="flex_container" data-par='container'> 
   <div class="calc">
        <label for="debt">Долг по ТТН</label>
    <input type="text" data-text='debt' inputmode="decimal" class="debt"> <br>
    <label for="dateOne">Начало периода </label>
        <input type="date" data-date='start' class="dateOne">
         <label for="checkOne">Включена в расчет </label>
        <input type="checkbox"  id="checkOne"><br>
    <label for="dateTwo">Конец периода </label>
        <input type="date" data-date='end' class="dateTwo">
       </div>   
<div class="out">
    <div class="out1" data-out='day'></div>
    <div class="out2" data-out='fine'></div>
    <div class="out3" data-out='percent'></div>
      </div>  
    </div> 
       </div>`

    });
    addScript()
    return  document.querySelector('#app').innerHTML = result;

}



function addScript() {
    const script = document.createElement('script')
    let before = document.querySelector('#before');

    body.insertBefore(script,before)
    script.setAttribute('src','script2.js')
    addScript = () => {};

}

