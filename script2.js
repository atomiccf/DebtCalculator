const start = document.getElementById('calc');
const dateStart = document.getElementsByClassName('dateOne')
const dateEnd = document.getElementsByClassName('dateTwo')
const debt = document.getElementsByClassName('debt')
const outOne = document.getElementsByClassName('out1')
const outTwo = document.getElementsByClassName('out2')
const outThree = document.getElementsByClassName('out3')


function calculateDade(start, end) {
    let dateArr = []

    for (let i = 0; i < dateStart.length && i < dateEnd.length; i++) {
        const a = new Date(start[i].value);
        const b = new Date(end[i].value);
        const day = Math.ceil(86400000 / (1000 * 3600 * 24));
        let timeDiff = Math.abs(b.getTime() - a.getTime());
        let dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        dateArr.push(dayDiff + day)
        /*(isChecked()) ?  console.log([dayDiff + day]): console.log([dayDiff])*/

    }

    return dateArr

}

function calculateFine(debt) {
    let arrFine = [];
    let arrDelay = calculateDade(dateStart, dateEnd);
    const percent = 0.1;

    for (let k = 0; k < debt.length; k++) {
        arrFine.push((debt[k].value / 100 * percent * arrDelay[k]).toFixed(2));
    }

    return arrFine;
}


function calculatePercents(debt) {
    let arrPercent = [];
    let arrDelay = calculateDade(dateStart, dateEnd);
    const percent = 11.5;
    for (let j = 0; j < debt.length; j++) {

        arrPercent.push((debt[j].value / 100 * percent * arrDelay[j] / 365).toFixed(2));

    }

    return arrPercent;


}

/*function isChecked(){
    let chbox = document.querySelector('#checkOne')
    return (chbox.checked) ? true : false
      

}*/


function render(delay, fine, percent) {
    let arrDelay = calculateDade(dateStart, dateEnd);
    let arrFine = calculateFine(debt);
    let arrPercent = calculatePercents(debt);

    Array.from(delay).forEach((elem, index) => {
        isNaN(arrDelay[index]) ? elem.innerText = ` введите данные` : elem.innerText = ` Просрочка ${arrDelay[index]} дней`;
    })

    Array.from(fine).forEach((elem, index) => {
        isNaN(arrFine[index]) ? elem.innerText = ` введите данные` : elem.innerText = ` Пеня ${arrFine[index]} рублей `;
    })

    Array.from(percent).forEach((elem, index) => {
        isNaN(arrPercent[index]) ? elem.innerText = ` введите данные` : elem.innerText = ` Проценты   ${arrPercent[index]} рублей`;
    })
}

start.addEventListener('click', () => {

    render(outOne, outTwo, outThree)

});



