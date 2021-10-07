const Koa = require('koa');
const Router = require('@koa/router');
const fs = require('fs');
const auth = require('basic-auth');
const bodyParser = require('koa-bodyparser');

const app = new Koa();
const router = new Router();

const session = require('koa-session-auth');
const APPLICATION_SECRET = 'NOTAREALSECRET'
app.keys = [APPLICATION_SECRET]

const dataFile = "data.json";
const user = { name: 'user', pass: 'secret'};
const admin = {name: 'admin', pass: 'secret'};

const isUser = function ({name, pass}) {
	try {
		return (name === user.name && pass === user.pass);
	} catch (e) {
		return false;
	};
}

const isAdmin = function ({name, pass}) {
	try {
		return (name === admin.name && pass === admin.pass);
	} catch (e) {
		return false;
	};
}

const login = function (username, password) {
	const credentials = { name: username, pass: password }
	if( isUser(credentials) || isAdmin(credentials) ) {
		return new Promise(resp => resp(true));
	} else {
		return new Promise(resp => resp(false));
	}
}

const getStats = function () {
	const raw = fs.readFileSync(dataFile, 'utf8');
	var stats = {
		numberOfCalls: 0,
		lastMessage: ""
	};
	try {
		stats = JSON.parse(raw);
	} catch (e) {
		//
	};
	
	return stats;
}	

const saveMessage = function ({message, from, to}) {
	var {numberOfCalls, lastMessage} = getStats();

	const log = fs.createWriteStream(dataFile, {flags: 'w'});
	
	var data = {
		numberOfCalls: ++numberOfCalls,
		lastMessage: message
	};
	
	log.write(JSON.stringify(data));
	log.end();
}

app.use(async (ctx, next) => {
	try {
		await next();
	} catch (err) {
		if (401 == err.status) {
			ctx.status = 401;
			ctx.body = 'Authentication Error'
		} else {
			throw err;
		}
	}
});

app.use(session({useCookie: false}, app));
app.use(bodyParser());

router
	.get('/stats', async (ctx) => {
		if (ctx.session.logged && ctx.session.admin) {
			ctx.status = 200;
			ctx.body = getStats();
		} else {
			ctx.throw(403, 'Forbidden');
		}
	})
	.post('/message', async (ctx) => {
		if (ctx.session.logged) {
			saveMessage(ctx.request.body);
			ctx.status = 201;
		} else {
			ctx.throw(401, 'Access Denied');
		}
	})
	.post('/login', async (ctx) => {
		if (!ctx.request.body.username || !ctx.request.body.password) {
			ctx.throw(400, "Missing Username and Password");
		}
		var {username, password} = ctx.request.body;
		var isAdministrator = isAdmin({name: username, pass:password});
		const success = await login(username, password);
		if (success) {
			
			ctx.session.logged = true;
			ctx.session.username = username;
			ctx.session.admin = isAdministrator;
			ctx.session.save();
			ctx.status = 200;
			ctx.body = "WELCOME " + username;
		} else {
			ctx.throw(401, 'Access Denied')
		}

	})
	.get('/logout', (ctx) => {
		ctx.session.logged = false;
		ctx.session.username = undefined;
		ctx.session.admin = false;
		ctx.session.save();
		ctx.status = 200;
	}
);

app
	.use(router.routes())
	.use(router.allowedMethods());

app.listen(3000);