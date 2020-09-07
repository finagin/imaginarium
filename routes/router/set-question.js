const Guess = require('../helpers/Guess');


module.exports = function(app, db) {
	app.post('/set-question', async (req, res) => {
		let room_id = req.body.room_id,
			  question = req.body.question;

    try {
      const guess = await Guess.getQuestion(app, db, room_id);

      if (guess.exist) {
        await Guess.setQuestion(app, db, room_id, question);
      } else {
        await Guess.createQuestion(app, db, room_id, question);
      }

      return res.json({
        success: true,
      })
    } catch(error) {
      return res.json({
        success: false,
        error: error,
      });
    }
	});
};