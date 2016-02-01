import ParseApp           from 'lib/ParseApp';
import { get, post, del } from 'lib/AJAX';
import { unescape }       from 'lib/StringEscaping';

let appsStore = null;

const AppsManager = {
  seed() {
    let promise = get('/parse-dashboard-config.json');
    promise.then(({ apps }) => {
      appsStore = appsStore.concat(apps.map(app => new ParseApp(app)));
    }).fail(() => {
      //TODO(drewgross) some sort of indication that there was a problem with the configuration
      alert('bad json');
    });
    let appsData = document.getElementById('appsData');
    if (appsData) {
      let rawApps = JSON.parse(unescape(appsData.innerHTML || '[]'));
      appsStore = rawApps.map(raw => new ParseApp(raw));
    } else {
      appsStore = [];
    }
    return promise;
  },

  apps() {
    if (!appsStore) {
      AppsManager.seed();
    }
    return appsStore;
  },

  findAppBySlug(slug) {
    let apps = this.apps();
    for (let i = apps.length; i--;) {
      if (apps[i].slug === slug) {
        return apps[i];
      }
    }
    return null;
  },

  findAppByName(name) {
    let apps = this.apps();
    for (let i = apps.length; i--;) {
      if (apps[i].name === name) {
        return apps[i]
      }
    }
    return null;
  },

  create(name, connectionURL) {
    let payload = {
      parse_app: { name }
    };
    if (connectionURL) {
      payload.parse_app.connectionString = connectionURL;
    }
    return post('/apps', payload).then((response) => {
      let newApp = new ParseApp(response.app);
      appsStore.push(newApp);
      return newApp;
    });
  },

  deleteApp(slug, password) {
    return del('/apps/' + slug + '?password_confirm_delete=' + password).then(() => {
      for (let i = 0; i < appsStore.length; i++) {
        if (appsStore[i].slug == slug) {
          appsStore.splice(i, 1);
          return;
        }
      }
    });
  },

  // Fetch the latest usage and request info for the apps index
  getAppsInfo() {
    return get('/apps_info').then((response) => {
      this.apps().forEach((app) => {
        let info = response[app.slug];
        if (info) {
          app.installations = info.installations;
          app.requests = info.requests;
          app.users = info.users;
          app.requestLimit = info.requestLimit;

          app.is_cloning = info.is_cloning;
          if (app.is_cloning) {
            app.clone_message = info.clone_message;
            app.clone_status = info.clone_status;
            app.clone_progress = info.clone_progress;
          }
        }
      });
    });
  },

  // Options should be a list containing a subset of
  // ["schema", "app_settings", "config", "cloud_code", "background_jobs"]
  // indicating which parts of the app to clone.
  cloneApp(slug, name, options) {
    //Clone nothing by default
    let optionsForRuby = {
      cloud_code: false,
      background_jobs: false,
      config: false,
      schema: false,
      app_settings: false,
      data: false,
    };
    options.forEach((option) => {
      if (option !== 'data') { //Data cloning not supported yet, but api_server still requires the key to be present
        optionsForRuby[option] = true;
      }
    });
    let path = '/apps/' + slug + '/clone_app';
    let request = post(path, {
      app_name: name,
      options: optionsForRuby,
    });
    request.then(({ app }) => {
      if (!appsStore) {
        AppsManager.seed();
      }
      appsStore.push(new ParseApp(app));
    });
    return request;
  },

  transferApp(slug, newOwner, password) {
    let payload = {
      new_owner_email: newOwner,
    }
    if (password) {
      // Users who log in with oauth don't have a password,
      // and don't require one to transfer their app.
      payload.password_confirm_transfer = password;
    }

    let promise = post('/apps/' + slug + '/transfer', payload);
    promise.then((response) => {
      //TODO(drewgross) modify appsStore to reflect transfer
    });
    return promise;
  }
}

export default AppsManager;