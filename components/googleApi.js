const { google } = require('googleapis');


class GoogleApi {
	constructor() {
		this.oauth2Client = new google.auth.OAuth2(
			process.env.CLIENT_ID,
			process.env.CLIENT_SECRET,
			process.env.REDIRECT_URL
		);
		this.scopes = [
			'https://www.googleapis.com/auth/fitness.activity.read',
		];
		this.url = this.oauth2Client.generateAuthUrl({
			// 'online' (default) or 'offline' (gets refresh_token)
			access_type: 'offline',

			// If you only need one scope you can pass it as a string
			scope: this.scopes
		});
		// set auth as a global default
		google.options({
			auth: this.oauth2Client
		});
	}

	get redirectUrl() {
		return this.url;
	}

	async getTokens(code) {
		return await this.oauth2Client.getToken(code)
	}


	async getSteps(startTimeMillis, endTimeMillis, tokens) {
		
		var auth = this.oauth2Client.setCredentials(tokens);

		const fitness = google.fitness({ version: 'v1', auth })

		let result = await fitness.users.dataset.aggregate({
			userId: 'me',
			requestBody: {
				aggregateBy:
					[{
						dataTypeName: 'com.google.step_count.delta',
						dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
					}],
				bucketByTime: { durationMillis: 86400000 },
				startTimeMillis,
				endTimeMillis
			}
		});
		let stepsToAdd = [];

		result.data.bucket.forEach((day) => {
			stepsToAdd.push({ date: parseInt(day.startTimeMillis), step: day.dataset[0].point[0].value[0].intVal })
		})

		return stepsToAdd

	}
}

module.exports = {
	GoogleApi: GoogleApi
}