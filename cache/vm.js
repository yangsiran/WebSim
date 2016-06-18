(function () {
  var addrFlw = [
    { type: 'inst',  addr: 0x408ed4 },
    { type: 'read',  addr: 0x10019d94 },
    { type: 'inst',  addr: 0x408ed8 },
    { type: 'write', addr: 0x10019d88 },
    { type: 'inst',  addr: 0x408edc },
    { type: 'read',  addr: 0x10013220 },
    { type: 'inst',  addr: 0x408ee0 },
    { type: 'inst',  addr: 0x408ee4 },
    { type: 'write', addr: 0x100230b8 },
    { type: 'inst',  addr: 0x408ee8 }
  ];

  var data = {
    iCSz: 32 * 1024,
    dCSz: 32 * 1024,
    blkSz: 32,
    assoc: 1,
    rpl: 'lru',
    wrSty: 'wb',
    wrMiss: 'alloc',

    addrFlw: addrFlw,

    instCnt: 0,
    instMiss: 0,
    readCnt: 0,
    readMiss: 0,
    writeCnt: 0,
    writeMiss: 0,

    access: null
  };

  var iGroupNr = Math.floor(data.iCSz / data.assoc);
  var dGroupNr = Math.floor(data.dCSz / data.assoc);

  var iCache = [], dCache = [], time = 0;
  for (var i = 0 ; i < data.iCSz; i++)
    iCache[i] = { tag: -1, created: -1, access: -1 };
  for (var i = 0 ; i < data.dCSz; i++)
    dCache[i] = { tag: -1, created: -1, access: -1, dirty: false };

  function replace(cache, index, tag) {
    var vimtim;

    for (var i = 0; i < data.assoc; i++)
      if (cache[index * data.assoc + i].tag == -1)
        break;
    if (i < data.assoc) vimtim = i;
    else vimtim = 0;

    for (var i = 1; i < data.assoc; i++) {
      if (data.rpl == 'lru') {
        if (cache[index * data.assoc + i].access <
            cache[index * data.assoc + vimtim].access)
          vimtim = i;
      }
      if (data.rpl == 'fifo') {
        if (cache[index * data.assoc + i].access <
            cache[index * data.assoc + vimtim].access)
          vimtim = i;
      }
    }
    cache[index * data.assoc + vimtim].tag = tag;
    cache[index * data.assoc + vimtim].created = time;
    cache[index * data.assoc + vimtim].access = time;
  }

  function step() {
    var op = addrFlw.shift();
    if (!op)
      return;

    var offset, index, tag, grpIdx;
    switch (op.type) {
      case 'inst':
        offset = op.addr % data.blkSz;
        index = Math.floor(op.addr / data.blkSz) % iGroupNr;
        tag = Math.floor(Math.floor(op.addr / data.blkSz) / iGroupNr);
        data.access = {
          type: 'Instruction', addr: op.addr,
          offset: offset, blkNum: tag * iGroupNr + index, index: index
        };
        for (var i = 0; i < data.assoc; i++)
          if (iCache[index * data.assoc + i].tag == tag)
            break;
        if (i < data.assoc) {
          data.access.hit = 'Hit';
          iCache[index * data.assoc + i].access = time;
        } else {
          data.access.hit = 'Miss';
          replace(iCache, index, tag);
          data.instMiss++;
        }
        data.instCnt++;
        break;

      case 'read':
      case 'write':
        offset = op.addr % data.blkSz;
        index = Math.floor(op.addr / data.blkSz) % dGroupNr;
        tag = Math.floor(Math.floor(op.addr / data.blkSz) / dGroupNr);
        data.access = {
          type: op.type == 'read' ? 'Read' : 'Write', addr: op.addr,
          offset: offset, blkNum: tag * dGroupNr + index, index: index
        };
        for (var i = 0; i < data.assoc; i++)
          if (dCache[index * data.assoc + i].tag == tag)
            break;
        if (i < data.assoc) {
          data.access.hit = 'Hit';
          dCache[index * data.assoc + i].access = time;
        } else {
          data.access.hit = 'Miss';
          if (op.type == 'read' || data.wrMiss == 'alloc')
            replace(dCache, index, tag);
          if (op.type == 'read') data.readMiss++;
          else data.writeMiss++;
        }
        if (op.type == 'read') data.readCnt++;
        else data.writeCnt++;
        break;

      default:
    }
    time++;
  }

  new Vue({
    el: '#root',
    data: data,
    methods: {
      step: step
    },
    computed: {
      instRate: function () {
        return (this.instCnt ? this.instMiss / this.instCnt * 100 : 0).toFixed(2) + '%';
      },
      readRate: function () {
        return (this.readCnt ? this.readMiss / this.readCnt * 100 : 0).toFixed(2) + '%';
      },
      writeRate: function () {
        return (this.writeCnt ? this.writeMiss / this.writeCnt * 100 : 0).toFixed(2) + '%';
      },
      totCnt: function () {
        return this.instCnt + this.readCnt + this.writeCnt;
      },
      totMiss: function () {
        return this.instMiss + this.readMiss + this.writeMiss;
      },
      totRate: function () {
        return (this.totCnt ? this.totMiss / this.totCnt * 100 : 0).toFixed(2) + '%';
      }
    },
    watch: {
      iCSz: function () {
        iGroupNr = Math.floor(data.iCSz / data.assoc);
        for (var i = iCache.length ; i < data.iCSz; i++)
          iCache[i] = { tag: -1, created: -1, access: -1 };
      },
      dCSz: function () {
        dGroupNr = Math.floor(data.dCSz / data.assoc);
        for (var i = dCache.length ; i < data.dCSz; i++)
          dCache[i] = { tag: -1, created: -1, access: -1, dirty: false };
      },
      assoc: function () {
        iGroupNr = Math.floor(data.iCSz / data.assoc);
        dGroupNr = Math.floor(data.dCSz / data.assoc);
      }
    }
  });
})();
