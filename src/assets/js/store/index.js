import Vuex from 'vuex';
import Vue from 'vue';

Vue.use(Vuex);

export const store = new Vuex.Store({
  state: {
    player: {
      id: null,
      status: '',
      gameMaster: false,
    },
    game: {
      run: false,
      action: '',
    },
    handCards: [{
      img: 'url',
      playerStyle: ''
    }],
    tableCards: [{
      img: 'url',
      hasMarker: false,
      playerStyle: ''
    }],
    newCards:[{
      img: 'url',
      playerStyle: ''
    }],
    party: [{
      id: 237,
      position: 0,
      nickName: 'Horror House',
      playerStyle: ''
    }],
  },
  actions: {
    setPlayer({commit}) {
      // ajax to set a player
      // .success( start commit)
  
      let note;
      
      commit('SET_PLAYER', note)
    },
    setPlayerStatus({commit}, status) {
      commit('SET_PLAYER', status)
    },
    myTurnStart({commit}) {
      commit('MY_TURN_START')
    },
    myTurnEnd({commit}) {
      commit('MY_TURN_END')
    },
    gameStart({commit}) {
      commit('GAME_START')
    },
    getNewCards({commit}) {
      // ajax to get cards
      // if(state.player.status === 'handsFree')
      // add 6 cards
      // .success( start commit)
      // cards = response;
  
      let cards=[];
      
      commit('GET_NEW_CARDS', cards)
    },
    getTableCards({commit}) {
      // ajax to get cards
      // .success( start commit)
      // cards = response;
      
      let cards=[];
      
      commit('GET_TABLE_CARDS', cards)
    },
    getPartyResults({commit}, data) {
      // ajax get leader board
      
      let results = data;
      
      commit('GET_PARTY_RESULTS', results)
    }
  },
  mutations: {
    SET_PLAYER(state, note) {
      state.player = note;
    },
    SET_PLAYER_STATUS(state, status) {
      state.player.status = status;
    },
    MY_TURN_START(state) {
      state.player.gameMaster = true;
    },
    MY_TURN_END(state) {
      state.player.gameMaster = false;
    },
    GAME_START(state) {
      state.game.run = true;
    },
    GET_TABLE_CARDS(state, cards) {
      state.tableCards.push(...cards);
    },
    GET_NEW_CARDS(state, cards) {
      state.handCards.push(...cards);
      state.newCards = cards;
    },
    GET_PARTY_RESULTS(state,results) {
      state.party = results;
    }
  },
  getters: {
    player(state) {
      return state.player
    },
    game(state) {
      return state.game
    },
    tableCards(state) {
      return state.tableCards
    },
    handCards(state) {
      return state.handCards
    },
    newCards(state) {
      return state.newCards
    },
    party(state) {
      return state.party
    }
  },
  modules: {}
});