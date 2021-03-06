const sql = require('./sqlCommands');

module.exports = async function(app, db) {
	let gameSt = {
		prepare: 'game-prepare',
		start: 'game-start',
		gmCardSet: 'gm-card-set',
		allCardSet: 'all-card-set',
		allGuessDone: 'all-guess-done',
	};
	
	//POST
	app.post('/party-create', async (req, res) => {
		let nickName = req.body.nickName,
				userId,
				roomId;
		
		function roomCreate(resolve) {
			let roomCreateReq = db.format(sql.ii2, ["room", "game_action",'player_count', gameSt.prepare, 1]);
			db.query(roomCreateReq, function (err, results) {
				if (err) throw err;
				roomId = results.insertId;
				return resolve();
			});
		}
		function playerCreate(resolve) {
			let playerCreateReq = db.format(sql.ii3, ['users', 'nick_name', 'game_master','player_style', nickName, true, null]);
			db.query(playerCreateReq, function (err, results) {
				if (err) throw err;
				userId = results.insertId;
				return resolve();
			});
		}
		function chainPlayer() {
			let chainPlayerReq = db.format(sql.ii2, ['user__room', 'room_id', 'user_id', roomId, userId]);
			db.query(chainPlayerReq, function (err, results) {
				if (err) throw err;
				res.json({
					room_id: roomId,
					user_id: userId,
					nick_name: nickName,
					player_style: null,
					game_master: true,
					game_action: gameSt.prepare,
				});
			});
		}
		function setQuestonField(resolve) {
			let setQuestonFieldReq = db.format(sql.ii2, ["room__question", 'room_id','question', roomId, '']);
			db.query(setQuestonFieldReq, function (err, results) {
				if (err) throw err;
				return resolve();
			});
		}
		
		new Promise(resolve => {
			roomCreate(resolve);
		}).then(() => {
			new Promise(resolve => {
				playerCreate(resolve);
			}).then(() => {
				new Promise(resolve => {
					setQuestonField(resolve);
				}).then(()=>{
					chainPlayer();
				})
			})
		})
	});
	
	
	app.post('/user-join', async (req, res) => {
		let roomId = req.body.roomId,
				nickName = req.body.nickName,
				users = [],
				roomExist = false,
			  userExist = false,
				newCount,
				userId;
		
		
		function getUsers(resolve) {
			let getUsersIdReq = db.format(sql.sfw, ['user__room', 'room_id', roomId]);
			db.query(getUsersIdReq, function (err, results) {
				if (err) throw err;
				if(results.length > 0) {
					results.forEach((item)=>{
						users.push(item.user_id);
					})
				}
				return resolve();
			});
		}
		
		function getPlayersCount(resolve) {
			let getPlayersCountReq = db.format(sql.sfw, ['room', 'id', roomId]);
			db.query(getPlayersCountReq, function (err, results) {
				if (err) throw err;
				if (results.length === 0) {
					res.json({success:false, err:'room_not_exist'});
				} else {
					roomExist = true;
					newCount = +results[0].player_count + 1;
				}
				return resolve();
			});
		}
		function userJoin(resolveMain) {
			new Promise(resolve => {
				checkNickName(resolve);
			}).then(()=>{
				if (userExist) {
					return resolveMain();
				} else {
					new Promise(resolve => {
						playerCreate(resolve);
					}).then(()=>{
						new Promise(resolve => {
							checkNickName(resolve);
						}).then(()=>{
							if (userExist) {
								playerCountUpdate();
								chainPlayer();
								return resolveMain();
							} else {
								res.json({success: false});
							}
						})
					})
				}
			})
		}
		function checkNickName(resolve) {
			let playerCreateReq = db.format(sql.sfw, ['users', 'nick_name', nickName]);
			db.query(playerCreateReq, function (err, results) {
				if (err) throw err;
				userExist = results.length > 0;
				if (userExist) {
					results.forEach((item)=>{
						if (users.includes(item.id)) {
							let data = {
								success: true,
								room_id: roomId,
								user_id: item.id,
								nick_name: nickName,
								player_style: item.player_style,
								game_master: item.game_master,
								game_action: gameSt.prepare,
							};
							res.json(data);
						}
					});
				}
				return resolve();
			});
		}
		function playerCreate(resolve) {
			let playerCreateReq = db.format(sql.ii3, ['users', 'nick_name','game_master','player_style', nickName, false, null]);
			db.query(playerCreateReq, function (err, results) {
				if (err) throw err;
				userId = results.insertId;
				return resolve();
			});
		}
		function playerCountUpdate() {
			let playerCountUpdateReq = db.format(sql.usw, ['room', 'player_count', newCount, 'id', roomId]);
			db.query(playerCountUpdateReq, function (err, results) {
				if (err) throw err;
			});
		}
		function chainPlayer() {
			let chainPlayerReq = db.format(sql.ii2, ['user__room', 'room_id', 'user_id', roomId, userId]);
			db.query(chainPlayerReq, function (err, results) {
				if (err) throw err;
			});
		}
		new Promise(resolve => {
			getUsers(resolve)
		}).then(()=>{
			new Promise(resolve => {
				getPlayersCount(resolve);
			}).then(()=>{
				if (roomExist) {
					new Promise(resolve => {
						userJoin(resolve)
					})
				}
			})
		})
	});
	
	
	
	app.post('/set-action', async (req, res) => {
		let roomId = req.body.room_id,
				action = req.body.action;
		
		let setActionReq = db.format(sql.usw, ['room', 'game_action', action, 'id', roomId]);
			db.query(setActionReq, function (err, results) {
				if (err) throw err;
				res.json({success: true});
			});
	});
	
	
	app.post('/set-question', async (req, res) => {
		let roomId = req.body.room_id,
				question = req.body.question;
		
		let checkQuestionReq = db.format(sql.sfw, ['room__question', 'room_id', roomId ]);
		db.query(checkQuestionReq, function (err, results) {
			if (err) throw err;
			if (results.length > 0) {
				setQuestion();
			} else {
				createQuestion();
			}
		});
		
		function createQuestion() {
			let createQuestionReq = db.format(sql.ii2, ['room__question', 'question', 'room_id', question, roomId]);
			db.query(createQuestionReq, function (err, results) {
				if (err) throw err;
				res.json({success: true});
			});
		}
		
		function setQuestion() {
			let setQuestionReq = db.format(sql.usw, ['room__question', 'question', question, 'room_id', roomId]);
			db.query(setQuestionReq, function (err, results) {
				if (err) throw err;
				res.json({success: true});
			});
		}
	});
	
	
	app.post('/card-main', async (req, res) => {
		let handCardId = req.body.id,
				cardId = req.body.card_id,
				roomId = req.body.room_id,
				userId = req.body.user_id,
				imgUrl = req.body.img_url,
				tableCard;
		
		function addMainCard (resolve) {
			let addMainCardReq = db.format(sql.ii3,
				['cards_on_table','img_url', 'card_id', 'is_main', imgUrl, cardId, true]);
			db.query(addMainCardReq, function (err, results) {
				if (err) throw err;
				tableCard = results.insertId;
				return resolve();
			});
		}
		function noteTableCard (resolve) {
			let noteTableCardReq = db.format(sql.ii3,
				['room__table', 'room_id', 'table_card_id', 'card_id', roomId, tableCard, cardId]);
			db.query(noteTableCardReq, function (err, results) {
				if (err) throw err;
				return resolve();
			});
		}
		function noteTableCard2(resolve) {
			let noteTableCard2Req = db.format(sql.ii3,
				['user__table', 'user_id', 'table_card_id', 'is_main', userId, tableCard, true]);
			db.query(noteTableCard2Req, function (err, results) {
				if (err) throw err;
				return resolve();
			});
		}
		function changeGameStatus() {
			let changeGameStatusReq = db.format(sql.usw,
				['room', 'game_action', gameSt.gmCardSet, 'id', roomId]);
			db.query(changeGameStatusReq, function(err, results) {
				if (err) throw err;
				res.json({success: true});
			});
		}
		function removeFromHand(resolve) {
			let removeFromHandReq = db.format(sql.dfw,
				['cards_in_hand', 'id', handCardId]);
			db.query(removeFromHandReq, function (err, results) {
				if (err) throw err;
				return resolve();
			});
		}
		
		new Promise(resolve => {
			addMainCard(resolve);
		}).then(() => {
			new Promise(resolve => {
				noteTableCard(resolve);
			}).then(()=>{
				new Promise(resolve => {
					noteTableCard2(resolve);
				}).then(()=>{
					new Promise(resolve => {
						removeFromHand(resolve);
					}).then(()=>{
						changeGameStatus();
					})
				})
			})
		});
	});
	
	
	app.post('/card-fake', async (req, res) => {
		let handCardId = req.body.id,
				cardId = req.body.card_id,
				roomId = req.body.room_id,
				userId = req.body.user_id,
				imgUrl = req.body.img_url,
				playersCount,
				cardsCount,
				tableCard;
		
		function addFakeCard(resolve) {
			let addFakeCardReq = db.format(sql.ii3,
				['cards_on_table','img_url', 'card_id', 'is_main', imgUrl, cardId, false]);
			db.query(addFakeCardReq, function (err, results) {
				if (err) throw err;
				tableCard = results.insertId;
				return resolve();
			});
		}
		function noteTableCard(resolve) {
			let noteTableCardReq = db.format(sql.ii3,
				['room__table', 'room_id', 'table_card_id','card_id', roomId, tableCard, cardId]);
			db.query(noteTableCardReq, function (err, results) {
				if (err) throw err;
				return resolve();
			});
		}
		function noteTableCard2(resolve) {
			let noteTableCard2Req = db.format(sql.ii3,
				['user__table', 'user_id', 'table_card_id','is_main', userId, tableCard, false]);
			db.query(noteTableCard2Req, function (err, results) {
				if (err) throw err;
				return resolve();
			});
		}
		function removeFromHand(resolve) {
			let removeFromHandReq = db.format(sql.dfw, ['cards_in_hand', 'id', handCardId]);
			db.query(removeFromHandReq, function (err, results) {
				if (err) throw err;
				return resolve();
			});
		}
		function getCounts(resolveMain) {
			let getPlayersCount = db.format(sql.sfw, ['room', 'id', roomId]),
				getCardsCount = db.format(sql.sfw, ['room__table', 'room_id', roomId]);
			
			new Promise(resolve => {
				db.query(getPlayersCount, function(err, results) {
					if (err) throw err;
					playersCount = results[0].player_count;
					return resolve();
				});
			}).then(()=>{
				db.query(getCardsCount, function (err, results) {
					if (err) throw err;
					cardsCount = results.length;
					return resolveMain();
				});
			});
		}
		function iAmLast() {
			return +cardsCount === +playersCount;
		}
		function changeGameStatus() {
			let changeGameStatusReq = db.format(sql.usw,
				['room', 'game_action', gameSt.allCardSet, 'id', roomId]);
			db.query(changeGameStatusReq, function(err, results) {
				if (err) throw err;
				res.json({success: true});
			});
		}
		
		new Promise(resolve => {
			addFakeCard(resolve)
		}).then(() => {
			new Promise(resolve => {
				noteTableCard(resolve)
			}).then(()=>{
				new Promise(resolve => {
					noteTableCard2(resolve)
				}).then(()=>{
					new Promise(resolve => {
						removeFromHand(resolve)
					}).then(()=>{
						new Promise(resolve => {
							getCounts(resolve);
						}).then(()=>{
							if (iAmLast()) {
								changeGameStatus();
							} else {
								res.json({success: true});
							}
						})
					})
				})
			})
		});
	});
	
	
	app.post('/card-guess', async (req, res) => {
		let userId = req.body.user_id,
				roomId = req.body.room_id,
				guessId = req.body.guess_id,
				playerStyle = req.body.player_style,
				iAmLast = false,
				userCount = 0,
				userGuessed = 0,
				userIds = [],
				checked = false;
		
		function checkPlayer(resolve) {
			let checkPlayerReq = db.format(sql.sfw,
				['user__table', 'user_id', userId]);
			
			db.query(checkPlayerReq, function(err, results) {
				if (err) throw err;
				if(results[0].hasOwnProperty('table_card_id')) {
					checked = results[0].table_card_id !== parseInt(guessId);
				}
				return resolve();
			});
		}
		function makeGuessCard(resolve) {
			let makeGuessCardReq = db.format(sql.ii3,
				['user__guess', 'user_id', 'guess_id', 'player_style', userId, guessId, playerStyle]);
			
			db.query(makeGuessCardReq, function(err, results) {
				if (err) throw err;
				return resolve();
			});
		}
		function getCounts(resolveMain) {
			new Promise(resolve => {
				getUsersId(resolve);
			}).then(()=>{
				new Promise(resolve => {
					getGuessedUsers(resolve);
				}).then(()=>{
					iAmLast = userGuessed === (userCount - 1);
					return resolveMain();
				})
			});
		}
		function getUsersId(resolve) {
			let getUsersIdReq = db.format(sql.sfw, ['user__room', 'room_id', roomId]);
			db.query(getUsersIdReq, function (err, results) {
				if (err) throw err;
				userCount = results.length;
				userIds = results.map((item)=>{
					return item.user_id;
				});
				return resolve();
			});
		}
		function getGuessedUsers(resolve) {
			userIds.forEach((currentId, index)=>{
				let getGuessedUsersReq = db.format(sql.sfw, ['user__guess', 'user_id', currentId]);
				db.query(getGuessedUsersReq, function (err, results) {
					if (err) throw err;
					if (results.length > 0) {
						userGuessed++;
					}
					if(index >= (userIds.length - 1)) {
						return resolve();
					}
				});
			});
		}
		function changeGameStatus() {
			let changeGameStatusReq = db.format(sql.usw,
				['room', 'game_action', gameSt.allGuessDone, 'id', roomId]);
			db.query(changeGameStatusReq, function(err, results) {
				if (err) throw err;
				res.json({success: true, iAmLast:true});
			});
		}
		
		new Promise(resolve => {
			checkPlayer(resolve);
		}).then(()=>{
			if(checked) {
				new Promise(resolve => {
					makeGuessCard(resolve);
				}).then(()=>{
					new Promise(resolve => {
						getCounts(resolve);
					}).then(()=>{
						if (iAmLast) {
							changeGameStatus();
						} else {
							res.json({success: true, iAmLast: false});
						}
					})
				});
			} else {
				res.json({success: false});
			}
		})
	});
	
	
	app.post('/table-clear', async (req, res) => {
		let roomId = req.body.room_id,
				tableCards=[],
				cardsId = [],
				distribution = {};
		
		function getTableCards(resolve) {
			let getTableCardsReq = db.format(sql.sfw, ['room__table','room_id', roomId]);
			db.query(getTableCardsReq, function (err, results) {
				if (err) throw err;
				tableCards = results.map((item,index) => {
					if (item.hasOwnProperty('table_card_id')) {
						return item.table_card_id
					}
				});
				cardsId = results.map((item,index) => {
					if (item.hasOwnProperty('card_id')) {
						return item.card_id
					}
				});
				return resolve();
			});
		}
		function getDistribution(resolve) {
			let getDistributionReq = db.format(sql.sfw,
				['distribution', 'room_id', roomId]);
			db.query(getDistributionReq, function (err, results) {
				if (err) throw err;
				distribution = results[0];
				return resolve();
			});
		}
		function moveToBasket(resolve) {
			if (cardsId.length > 0) {
				cardsId.forEach((currentId, index) => {
					let moveToBasketReq = db.format(sql.ii2,
						['in_basket', 'distribution_id', 'card_id', distribution.id, currentId]);
					db.query(moveToBasketReq, function (err, results) {
						if (err) throw err;
						if (index >= (cardsId.length - 1)) {
							return resolve();
						}
					});
				});
			} else {
				resolve();
			}
		}
		function cleanTableCards() {
			if (tableCards.length > 0) {
				tableCards.forEach((currentId, index) => {
					let cleanTableCardsReq = db.format(sql.dfw, ['cards_on_table', 'id', currentId]);
					db.query(cleanTableCardsReq, function (err, results) {
						if (err) throw err;
						if (index >= (tableCards.length - 1)) {
							res.json({success: true});
						}
					});
				});
			} else {
				res.json({success: true});
			}
		}
		
		new Promise(resolve => {
			getTableCards(resolve)
		}).then(()=>{
			new Promise(resolve => {
				getDistribution(resolve);
			}).then(()=>{
				new Promise(resolve => {
					moveToBasket(resolve);
				}).then(()=>{
					cleanTableCards()
				});
			})
		})
		
	});
	
	
	app.post('/set-distribution', async (req,res) => {
		let roomId = req.body.room_id,
				setDistributionReq = db.format(sql.ii1,
				['distribution', 'room_id', roomId]);
		
		db.query(setDistributionReq, function (err, results) {
			if (err) throw err;
			res.json({success:true});
		});
	});
	
	
	app.post('/create-new-cards', async (req, res) => {
		let roomId = req.body.room_id,
				cardsCount = req.body.cards_count,
				playersCount,
				distributionId,
				handCards = [],
				inBasketCards = [],
				cardsShelter = [];
		
		function getPlayersCount(resolve) {
			let getPlayersCountReq = db.format(sql.sfw,['room', 'id', roomId]);
			db.query(getPlayersCountReq, function (err, results) {
				if (err) throw err;
				playersCount = results[0].player_count;
				return resolve();
			});
		}
		function getHandCards(resolveMain) {
			let handCardsId = [];
			
			new Promise(resolve => {
				let getHandCardsIdReq = db.format(sql.sfw,['room__hand', 'room_id', roomId]);
				db.query(getHandCardsIdReq, function (err, results) {
					if (err) throw err;
					results.forEach((item)=>{
						handCardsId.push(item.hand_card_id);
					});
					return resolve();
				});
			}).then(()=>{
				if (handCardsId.length > 0) {
					handCardsId.forEach((currentId, index) => {
						let getHandCardsReq = db.format(sql.sfw, ['cards_in_hand', 'id', currentId]);
						db.query(getHandCardsReq, function (err, results) {
							if (err) throw err;
							results.forEach((item) => {
								handCards.push(item.card_id);
							});
							if (index >= (handCardsId.length - 1)) {
								return resolveMain();
							}
						});
					})
				} else {
					return resolveMain();
				}
			});
		}
		function getBasketCards(resolveMain) {
			new Promise(resolve => {
				let distributionReq = db.format(sql.sfw,['distribution', 'room_id', roomId]);
				db.query(distributionReq, function (err, results) {
					if (err) throw err;
					distributionId = results[0].id;
					return resolve();
				});
			}).then(()=>{
				let getBasketCardsReq = db.format(sql.sfw,['in_basket', 'distribution_id', distributionId]);
				db.query(getBasketCardsReq, function (err, results) {
					if (err) throw err;
					results.forEach((item)=>{
						inBasketCards.push(item.card_id);
					});
					return resolveMain();
				});
			});
		}
		function getCardsShelter(resolve) {
			let getCardsShelterReq = db.format(sql.sf,['cards']);
			db.query(getCardsShelterReq, function (err, results) {
				if (err) throw err;
				results.forEach((item)=>{
					cardsShelter.push(item.id);
				});
				return resolve();
			});
		}
		function basketIsFull() {
			let diff = cardsShelter.length - handCards.length - inBasketCards.length - playersCount * cardsCount;
			return diff < 0;
		}
		function clearBasket(resolveMain) {
			inBasketCards = [];
			new Promise(resolve => {
				let clearReq = db.format(sql.dfw,['distribution','id',distributionId]);
				db.query(clearReq, function (err, results) {
					if (err) throw err;
					return resolve();
				});
			}).then(()=>{
				let clearReq = db.format(sql.ii1,['distribution','room_id',roomId]);
				db.query(clearReq, function (err, results) {
					if (err) throw err;
					return resolveMain();
				});
			});
		}
		function getRandomCards(resolve) {
			let less = handCards.concat(inBasketCards),
					deletable;
					
			less.forEach((id)=>{
				deletable = cardsShelter.indexOf(id);
				cardsShelter.splice(deletable,1);
			});
			
			let j, temp;
			for(let i = cardsShelter.length - 1; i > 0; i--){
				j = Math.floor(Math.random()*(i + 1));
				temp = cardsShelter[j];
				cardsShelter[j] = cardsShelter[i];
				cardsShelter[i] = temp;
			}
			return resolve();
		}
		function setCards() {
			let users = [];
			
			new Promise(resolve => {
				let getUsersReq = db.format(sql.sfw,['user__room','room_id',roomId]);
				db.query(getUsersReq, function (err, results) {
					if (err) throw err;
					results.forEach((user)=>{
						users.push(user.user_id);
					});
					return resolve();
				});
			}).then(()=>{
				users.forEach((user,index)=>{
					for(let i=0; i < cardsCount; i++) {
						let setReq = db.format(sql.ii2,['new_cards','card_id', 'user_id', cardsShelter[i], user]);
						db.query(setReq, function (err, results) {
							if (err) throw err;
						});
					}
					cardsShelter.splice(0,cardsCount);
					if(index >= (users.length - 1)) {
						res.json({success: true});
					}
				});
			});
		}
		
		new Promise(resolve => {
			getPlayersCount(resolve)
		}).then(()=>{
			new Promise(resolve => {
				getHandCards(resolve)
			}).then(()=>{
				new Promise(resolve => {
					getBasketCards(resolve)
				}).then(()=>{
					new Promise(resolve => {
						getCardsShelter(resolve)
					}).then(()=>{
						if (basketIsFull()) {
							new Promise(resolve => {
								clearBasket(resolve)
							}).then(()=>{
								new Promise(resolve => {
									getRandomCards(resolve);
								}).then(()=>{
									setCards();
								})
							})
						} else {
							new Promise(resolve => {
								getRandomCards(resolve);
							}).then(()=>{
								setCards();
							})
						}
					})
				})
			})
		})
	});
	
	
	app.post('/set-style', async (req, res) => {
		let style = req.body.player_style,
				userId = req.body.user_id,
				setStyleReq = db.format(sql.usw,
				['users', 'player_style', style, 'id', userId]);
		
			db.query(setStyleReq, function(err, results) {
				if (err) throw err;
				res.json({success: true});
			});
	});
	

	app.post('/turn-end', async (req, res) => {
		let roomId = req.body.room_id,
				usersId = [],
				users = [],
				gmId = null;
		
		function changeGameStatus(resolve) {
			let changeGameStatusReq = db.format(sql.usw, ['room', 'game_action', gameSt.start, 'id', roomId]);
			db.query(changeGameStatusReq, function(err, results) {
				if (err) throw err;
					return resolve();
			});
		}
		function getUsers(resolve) {
			let getUsersId = db.format(sql.sfw, ['user__room', 'room_id', roomId]);
			db.query(getUsersId, function(err, results) {
				if (err) throw err;
				results.forEach((item)=>{
					usersId.push(item.user_id);
				});
				return resolve();
			});
		}
		function findGM(resolve) {
			usersId.forEach((currentId,index)=>{
				let getUsers = db.format(sql.sfw, ['users', 'id', currentId]);
				db.query(getUsers, function(err, results) {
					if (err) throw err;
					results.forEach((item)=>{
						users.push(item);
						if (item.game_master) {
							gmId = item.id
						}
					});
					if(index >= (usersId.length - 1)) {
						return resolve();
					}
				});
			});
		}
		function demoteGM(resolve) {
			let demoteMeReq = db.format(sql.usw, ['users', 'game_master', false, 'id', gmId]);
			db.query(demoteMeReq, function(err, results) {
				if (err) throw err;
				return resolve();
			});
		}
		function findNewGM() {
			let current = 0,
					next;
				
			users.forEach((item,index)=>{
				if (+item.id === +gmId) {
					current = index;
				}
			});
			if (current < (users.length - 1)) {
				next = users[current + 1];
			} else {
				next = users[0];
			}
			
			
			let setGM = db.format(sql.usw, ['users', 'game_master', true, 'id', next.id]);
			db.query(setGM, function(err, results) {
				if (err) throw err;
				res.json({success: true});
			});
		}
		
		new Promise(resolve => {
			changeGameStatus(resolve);
		}).then(()=>{
			new Promise(resolve => {
				getUsers(resolve)
			}).then(()=>{
				new Promise(resolve => {
					findGM(resolve)
				}).then(()=>{
					new Promise(resolve => {
						demoteGM(resolve)
					}).then(()=>{
						findNewGM()
					})
				})
			})
		});
	});
	

	app.post('/table-cards', async (req, res) => {
		let roomId = req.body.room_id,
				cardIds = [],
				resp = [];
		
		function getCardsId(resolve) {
			let getCardsIdReq = db.format(sql.sfw, ['room__table', 'room_id', roomId]);
			db.query(getCardsIdReq, function (err, results) {
				if (err) throw err;
				cardIds = results.map((item)=>{
					return item.table_card_id;
				});
				return resolve();
			});
		}
		function getCards() {
			cardIds.forEach((currentId, index)=>{
				let getCardsIdReq = db.format(sql.sfw, ['cards_on_table', 'id', currentId]);
				db.query(getCardsIdReq, function (err, results) {
					if (err) throw err;
					let card = results[0],
							data = {
								img_url: card.img_url,
								card_id: card.card_id,
								id: card.id,
							};
					
					resp.push(data);
					if(index === (cardIds.length - 1)) {
						res.json(resp);
					}
				});
			})
		}
		
		new Promise(resolve => {
			getCardsId(resolve)
		}).then(()=>{
			getCards()
		})
	});
	
	
	app.post('/get-question', async (req, res) => {
		let roomId = req.body.room_id;
		
		let getQuestionReq = db.format(sql.sfw, ['room__question', 'room_id', roomId]);
		db.query(getQuestionReq, function (err, results) {
			if (err) throw err;
			if(results[0].question.length > 0) {
				res.json({question: results[0].question});
			} else {
				res.json({question:''});
			}
		});
	});
	
	
	app.post('/get-new-cards', async (req, res) => {
		let userId = req.body.user_id,
				roomId = req.body.room_id,
				cardsIds = [],
				resp = [],
				handCardIds = [];
			
			
		function getCardsId(resolve) {
			let getCardsIdReq = db.format(sql.sfw, ['new_cards', 'user_id', userId]);
			
			db.query(getCardsIdReq, function(err, results) {
				if (err) throw err;
				results.forEach((item)=>{
					cardsIds.push({id: item.card_id});
				});
				return resolve();
			})
		}
		function getImages(resolve) {
			cardsIds.forEach((item,index)=>{
				let getImagesReq = db.format(sql.sfw, ['cards', 'id', item.id]);
				
				db.query(getImagesReq, function(err, results) {
					if (err) throw err;
					item.img_url = results[0].img_url;
					
					if(index === (cardsIds.length - 1)) {
						return resolve();
					}
				})
			});
		}
		function deleteTheCopy() {
			let getCardsIdReq = db.format(sql.dfw, ['new_cards', 'user_id', userId]);
			
			db.query(getCardsIdReq, function(err, results) {
				if (err) throw err;
			})
		}
		function createHandCards(resolve) {
			cardsIds.forEach((item,index)=>{
				let createHandCardsReq = db.format(sql.ii2, ['cards_in_hand', 'card_id', 'img_url',  item.id, item.img_url]);
				
				db.query(createHandCardsReq, function(err, results) {
					if (err) throw err;
					handCardIds.push(results.insertId);
					
					if(index === (cardsIds.length - 1)) {
						return resolve();
					}
				})
			});
		}
		function chainWithRoom() {
			handCardIds.forEach((currentId)=>{
				let chainWithRoomReq = db.format(sql.ii2, ['room__hand', 'room_id', 'hand_card_id', roomId, currentId]);
				
				db.query(chainWithRoomReq, function(err, results) {
					if (err) throw err;
				});
			});
		}
		function chainWithUser() {
			handCardIds.forEach((currentId)=> {
				let chainWithUserReq = db.format(sql.ii2, ['user__hand', 'user_id', 'hand_card_id', userId, currentId]);
				
				db.query(chainWithUserReq, function (err, results) {
					if (err) throw err;
				});
			});
		}
		function getCards() {
			handCardIds.forEach((currentId,index)=>{
				let getCardsReq = db.format(sql.sfw, ['cards_in_hand', 'id', currentId]);
				
				db.query(getCardsReq, function(err, results) {
					if (err) throw err;
					resp.push(results[0]);
					
					if(index === (handCardIds.length - 1)) {
						res.json(resp);
					}
				})
			});
		}
		
		new Promise(resolve => {
			getCardsId(resolve)
		}).then(()=>{
			new Promise(resolve => {
				getImages(resolve)
			}).then(()=>{
				new Promise(resolve => {
					createHandCards(resolve);
				}).then(()=>{
					chainWithRoom();
					chainWithUser();
					deleteTheCopy();
					getCards();
				})
			})
		})
	});
	
	
	app.post('/get-my-cards', async (req, res) => {
		let userId = req.body.user_id,
				handCardIds = [],
				resp = [];
		
		function getHandCards(resolve) {
			let getHandCardsReq = db.format(sql.sfw, ['user__hand', 'user_id', userId]);
			
			db.query(getHandCardsReq, function(err, results) {
				if (err) throw err;
				results.forEach((item)=>{
					handCardIds.push(item.hand_card_id);
				});
				
				return resolve();
			})
		}
		function getMyCards() {
			if (handCardIds.length === 0) {
				res.json([]);
			} else {
				handCardIds.forEach((currentId, index) => {
					let getMyCardsReq = db.format(sql.sfw, ['cards_in_hand', 'id', currentId]);
					
					db.query(getMyCardsReq, function (err, results) {
						if (err) throw err;
						results.forEach((item) => {
							resp.push(item);
						});
						if (index >= handCardIds.length - 1) {
							res.json(resp);
						}
					});
				})
			}
		}
		
		new Promise(resolve => {
			getHandCards(resolve);
		}).then(()=>{
			getMyCards();
		})
	});
	
	
	app.post('/get-marks', async (req, res) => {
		let roomId = req.body.room_id,
				userIds = [],
				resp = [];
		
		function getUsersId(resolve) {
			let getCardsIdReq = db.format(sql.sfw, ['user__room', 'room_id', roomId]);
			db.query(getCardsIdReq, function (err, results) {
				if (err) throw err;
				userIds = results.map((item)=>{
					return item.user_id;
				});
				return resolve();
			});
		}
		function getMarks() {
			userIds.forEach((currentId, index)=>{
				let getMarksReq = db.format(sql.sfw, ['user__guess', 'user_id', currentId]);
				db.query(getMarksReq, function (err, results) {
					if (err) throw err;
					if (results.length > 0) {
						resp.push(results[0]);
					}
					if(index >= (userIds.length - 1)) {
						res.json(resp);
					}
				});
			});
		}
		
		new Promise(resolve => {
			getUsersId(resolve)
		}).then(()=>{
			getMarks()
		});
		
		
	});
	
	
	app.post('/count-score', async (req, res) => {
		let roomId = req.body.room_id,
				usersId = [],
				users = [],
				cards = [],
				marks = [],
				rewards = [];
		
		function getUsersIds(resolve) {
			let getUsersIdsReq =  db.format(sql.sfw, ['user__room', 'room_id', roomId]);
			db.query(getUsersIdsReq, function (err, results) {
				if (err) throw err;
				usersId = results;
				return resolve();
			});
		}
		function getUsers(resolve) {
			usersId.forEach((user,index)=>{
				let getMarksReq =  db.format(sql.sfw, ['users', 'id', user.id]);
				db.query(getMarksReq, function (err, results) {
					if (err) throw err;
					users.push(results[0]);
					if(index >= (usersId.length - 1)) {
						return resolve();
					}
				});
			});
		}
		function getMarks(resolve) {
			usersId.forEach((user,index)=>{
				let getMarksReq =  db.format(sql.sfw, ['user__guess', 'user_id', user.id]);
				db.query(getMarksReq, function (err, results) {
					if (err) throw err;
					if (results.length > 0) {
						marks.push(results[0]);
					}
					if(index >= (users.length - 1)) {
						return resolve();
					}
				});
			});
		}
		function getCards(resolve) {
			users.forEach((user,index)=>{
				let getCardsReq =  db.format(sql.sfw, ['user__table', 'user_id', user.id]);
				db.query(getCardsReq, function (err, results) {
					if (err) throw err;
					cards.push(results[0]);
					if(index >= (users.length - 1)) {
						return resolve();
					}
				});
			});
		}
		function countScores(resolve) {
			let max = marks.length;
			
			cards.forEach((card)=>{
				let score = 0;
				marks.forEach((mark)=>{
					if (card.table_card_id === mark.guess_id) {
						score++;
					}
				});

				if(card.is_main) {
					score = score === 0 || score === max
						? score = -3
						: score += 3;
				}
				
				rewards.push({
					id: card.user_id,
					score: score,
				})
			});
			return resolve();
		}
		function rewriteScores() {
			rewards.forEach((reward,index)=>{
				users.forEach((user)=>{
					if (user.id === reward.id) {
						reward.score =  +user.score + reward.score;
					}
				});
				
				let rewriteScoresReq = db.format(sql.usw, ['users', 'score', reward.score, 'id', reward.id]);
				db.query(rewriteScoresReq, function (err, results) {
					if (err) throw err;
					if(index >= (rewards.length - 1)) {
						res.json({success: true});
					}
				});
			});
		}
		
		new Promise(resolve => {
			getUsersIds(resolve)
		}).then(()=>{
			new Promise(resolve => {
				getUsers(resolve)
			}).then(()=>{
				new Promise(resolve => {
					getMarks(resolve)
				}).then(()=>{
					new Promise(resolve => {
						getCards(resolve)
					}).then(()=>{
						new Promise(resolve => {
							countScores(resolve)
						}).then(()=>{
							rewriteScores()
						})
					})
				})
			})
		})
	});
	
	
	app.post('/leader-board', async (req, res) => {
		let roomId = req.body.room_id,
				users = [],
				resp = [];
		
		function getUsersId(resolve) {
			let getUsersIdReq =  db.format(sql.sfw, ['user__room', 'room_id', roomId]);
			db.query(getUsersIdReq, function (err, results) {
				if (err) throw err;
				users = results;
				return resolve();
			});
		}
		function getUsers() {
			users.forEach((user,index)=>{
				let getUsersReq =  db.format(sql.sfw, ['users', 'id', user.id]);
				db.query(getUsersReq, function (err, results) {
					if (err) throw err;
					resp.push(results[0]);
					if(index >= (users.length - 1)) {
						res.json(resp);
					}
				});
			});
		}
		
		new Promise(resolve => {
			getUsersId(resolve);
		}).then(()=>{
			getUsers();
		});
	});
	
	
	app.post('/ping', async (req, res) => {
		let roomId = req.body.room_id,
				userId = req.body.user_id,
				resp = {};
		
		function getUser(resolve) {
			let getUsersIdReq =  db.format(sql.sfw, ['users', 'id', userId]);
			db.query(getUsersIdReq, function (err, results) {
				if (err) throw err;
				if (results.length > 0) {
					resp.gameMaster = results[0].game_master;
				}
				return resolve();
			});
		}
		function getRoom() {
			let getUsersIdReq =  db.format(sql.sfw, ['room', 'id', roomId]);
			db.query(getUsersIdReq, function (err, results) {
				if (err) throw err;
				if (results.length > 0) {
					resp.gameAction = results[0].game_action;
				}
				res.json(resp);
			});
		}
		
		new Promise(resolve => {
			getUser(resolve);
		}).then(()=>{
			getRoom();
		});
	});
	
	
	app.post('/add-card', async (req, res) => {
		let url = req.body.img_url;
		
		let addCardReq =  db.format(sql.ii1, ['cards', 'img_url', url]);
		db.query(addCardReq, function (err, results) {
			if (err) throw err;
			res.json({success: true});
		});
	});
};