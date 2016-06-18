(function() {
  var bus = {
    core: '',
    type: '',
    addr: ''
  };

  var Core = Vue.extend({
    template: 
      '<form class="core">' +
      '  <h1>Core {{ core }}</h1>' +
      '  Addr' +
      '  <select v-model="addr" number>' +
      '    <option v-for="addr in nrBlock">{{ addr }}</option>' +
      '  </select>' +
      '  <button @click.prevent="issue(core, \'read\', addr, $event)">' +
      '    Read' +
      '  </button>' +
      '  <button @click.prevent="issue(core, \'write\', addr, $event)">' +
      '    Write' +
      '  </button>' +
      '</form>',
    data: function () {
      return { addr: 0 };
    },
    props: ['core', 'nrBlock'],
    methods: {
      issue: function(core, type, addr, event) {
        bus.core = core;
        bus.type = type;
        bus.addr = addr;
      }
    }
  });

  var Cache = Vue.extend({
    template:
      '<div class="cache">' +
      '  <h1>Core {{ core }}</h1>' +
      '  <table>' +
      '    <tr>' +
      '      <th>Block Address</th>' +
      '      <th>State</th>' +
      '    </tr>' +
      '    <tr v-for="addr in nrBlock">' +
      '      <td>{{ addr }}</td>' +
      '      <td>{{ states[addr] }}</td>' +
      '    </tr>' +
      '  </table>' +
      '</div>',
    data: function () {
      return {
        bus: bus,
        states: []
      };
    },
    props: ['core', 'nrBlock'],
    watch: {
      bus: {
        handler: function (bus) {
          if (bus.core == this.core) {
            if (bus.type == 'read' && this.states[bus.addr] != 'Modified')
              this.states.$set(bus.addr, 'Shared');
            if (bus.type == 'write')
              this.states.$set(bus.addr, 'Modified');
          } else {
            if (bus.type == 'read' &&
                this.states[bus.addr] == 'Modified' || this.states[bus.addr] == 'Shared')
              this.states.$set(bus.addr, 'Shared');
            if (bus.type == 'write' && this.states[bus.addr])
              this.states.$set(bus.addr, 'Invalidated');
          }
        },
        deep: true
      }
    }
  });

  new Vue({
    el: '#root',
    data : {
      nrBlock: 0,
      nrCpu: 0,

      bus: bus
    },
    components: {
      'v-core': Core,
      'v-cache': Cache
    }
  });
})()
