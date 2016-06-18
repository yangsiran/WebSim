(function() {
  var insts = [
    { op: 'L.D',    dst: 'F8',  src1: '21',  src2: 'R3' },
    { op: 'L.D',    dst: 'F4',  src1: '16',  src2: 'R4' },
    { op: 'MULT.D', dst: 'F2',  src1: 'F4',  src2: 'F6' },
    { op: 'SUB.D',  dst: 'F10', src1: 'F8',  src2: 'F4' },
    { op: 'DIV.D',  dst: 'F12', src1: 'F2',  src2: 'F8' },
    { op: 'ADD.D',  dst: 'F8',  src1: 'F10', src2: 'F4' }
  ],
  inst_stat = [],
  load = [
    { busy: 'No', op: '', addr: '', value: '', time: -1 },
    { busy: 'No', op: '', addr: '', value: '', time: -1 },
    { busy: 'No', op: '', addr: '', value: '', time: -1 }
  ],
  rs = [
    { name: 'Add1',  busy: 'No', op: '', vj: '', vk: '', qj: '', qk: '', time: -1 },
    { name: 'Add2',  busy: 'No', op: '', vj: '', vk: '', qj: '', qk: '', time: -1 },
    { name: 'Add3',  busy: 'No', op: '', vj: '', vk: '', qj: '', qk: '', time: -1 },
    { name: 'Mult1', busy: 'No', op: '', vj: '', vk: '', qj: '', qk: '', time: -1 },
    { name: 'Mult2', busy: 'No', op: '', vj: '', vk: '', qj: '', qk: '', time: -1 },
  ],
  regs = [];

  var data = {
    insts: insts,
    inst_stat: inst_stat,
    load: load,
    rs: rs,
    regs: regs,
    clock: 0
  };

  for (var i = 0; i < insts.length; i++)
    inst_stat[i] = { is: '', ex: '', wb: '' };

  for (var i = 0; i < 32; i++)
    regs[i] = { qi: '', value: '' };

  var valCnt = 0;

  function getNewVal() {
    valCnt++;
    return 'M' + valCnt;
  }

  var instIdx = 0;

  function issueLoad(inst, i) {
    load[i].busy = 'Yes';
    load[i].op = instIdx;
    load[i].time = 2;
    var j = Number(inst.dst.substr(1));
    regs[j].qi = 'Load' + (i + 1);
  }

  function issueALU(inst, i) {
    switch (inst.op) {
      case 'ADD.D':
      case 'SUB.D':
        rs[i].time = 2;
        break;
      case 'MULT.D':
        rs[i].time = 10;
        break;
      case 'DIV.D':
        rs[i].time = 40;
        break;
      default:
        return;
    }
    rs[i].busy = 'Yes';
    rs[i].op = instIdx;

    var j = Number(inst.src1.substr(1));
    rs[i].qj = regs[j].qi;
    if (rs[i].qj == '') {
      rs[i].vj = regs[j].value;
      if (rs[i].vj == '')
        rs[i].vj = 'R[F' + j + ']';
    } else
      rs[i].vj = '';

    var k = Number(inst.src2.substr(1));
    rs[i].qk = regs[k].qi;
    if (rs[i].qk == '') {
      rs[i].vk = regs[k].value;
      if (rs[i].vk == '')
        rs[i].vk = 'R[F' + k + ']';
    } else
      rs[i].vk = '';

    var l = Number(inst.dst.substr(1));
    regs[l].qi = rs[i].name;
  }

  function issue(inst) {
    switch (inst.op) {
      case 'L.D':
        for (var i = 0; i < 3; i++) {
          if (load[i].busy == 'No') break;
        }
        if (i == 3) return;
        issueLoad(inst, i);
        break;
      case 'ADD.D':
      case 'SUB.D':
        for (var i = 0; i < 3; i++) {
          if (rs[i].busy == 'No') break;
        }
        if (i == 3) return;
        issueALU(inst, i);
        break;
      case 'MULT.D':
      case 'DIV.D':
        for (var i = 3; i < 5; i++) {
          if (rs[i].busy == 'No') break;
        }
        if (i == 5) return;
        issueALU(inst, i);
        break;
      default:
        return;
    }
    inst_stat[instIdx].is = data.clock;
    instIdx++;
  }

  function execute() {
    var fus = [];

    for (var i = 0; i < 3; i++) {
      if (load[i].time < 0) continue;
      if (inst_stat[load[i].op].ex == '')
        inst_stat[load[i].op].ex = '' + data.clock + '~';
      var inst = insts[load[i].op];
      if (load[i].addr == '')
        load[i].addr = 'R[' + inst.src2 + ']+' + inst.src1;
      load[i].time--;
      if (load[i].time == 0) {
        inst_stat[load[i].op].ex += data.clock;
        load[i].value = 'M[' + load[i].addr + ']';
      }
      if (load[i].time >= 0) continue;
      load[i].busy = 'No';
      load[i].addr = load[i].value = '';
      inst_stat[load[i].op].wb = data.clock;
      fus.push('Load' + (i + 1));
    }

    for (var i = 0; i < 5; i++) {
      if (rs[i].time < 0) continue;
      if (rs[i].vj && rs[i].vk) {
        if (inst_stat[rs[i].op].ex == '')
          inst_stat[rs[i].op].ex = '' + data.clock + '~';
        rs[i].time--;
        if (rs[i].time == 0)
          inst_stat[rs[i].op].ex += data.clock;
      }
      if (rs[i].time >= 0) continue;
      rs[i].busy = 'No';
      rs[i].vj = rs[i].vk = '';
      inst_stat[rs[i].op].wb = data.clock;
      fus.push(rs[i].name);
    }

    return fus;
  }

  function writeBackFU(fu) {
    var newVal = getNewVal();
    for (var i = 0; i < 32; i++)
      if (regs[i].qi == fu) break;
    regs[i].qi = '';
    regs[i].value = newVal;
    for (var i = 0; i < 5; i++) {
      if (rs[i].qj == fu) {
        rs[i].qj = '';
        rs[i].vj = newVal;
      }
      if (rs[i].qk == fu) {
        rs[i].qk = '';
        rs[i].vk = newVal;
      }
    }
  }

  function writeBack(fus) {
    for (var i = 0; i < fus.length; i++)
      writeBackFU(fus[i]);
  }

  function step() {
    data.clock++;
    var fus = execute();
    writeBack(fus);
    if (instIdx < insts.length)
      issue(insts[instIdx]);
  }

  function step5() {
    for (var i = 0; i < 5; i++) {
      step();
    }
  }

  new Vue({
    el: '#root',
    data: data,
    methods: {
      step: step,
      step5: step5
    }
  });
})();
