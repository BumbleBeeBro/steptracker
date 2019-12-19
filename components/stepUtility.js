const moment = require('moment');

const sortSteps = (steps) => {
	return steps.sort((a, b) => {
		return new Date(b.date) - new Date(a.date);
	})
}

const formatDates = async (steps) => {
	await steps.forEach(step => {
		step.date = moment(step.date).format('DD.MM.YYYY')
	})

	return steps;
}

const filterSteps = (steps, date) => {
	return steps.filter((item) => {
		return new Date(item.date) > date;
	})
}

module.exports = {
	sortSteps, formatDates, filterSteps
}
