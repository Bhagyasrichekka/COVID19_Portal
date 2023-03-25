const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, async (request, response) => {
      console.log("Server is Running....");
    });
  } catch (e) {
    console.log(`DB ERROR:${e.message}`);
    process.exit(1);
  }
};

initializeServer();

const getStateDetails = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};

const getDistrictDetails = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};

//login

const checkAuthentication = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Get

app.get("/states/", checkAuthentication, async (request, response) => {
  const getStatesQuery = `
            SELECT
              *
            FROM
             state
            ORDER BY
              state_id;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray.map((eachState) => getStateDetails(eachState)));
});

app.get("/states/:stateId", checkAuthentication, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT *
    FROM state
    WHERE
    state_id= ${stateId};`;
  const stateResult = await db.get(getStateQuery);
  response.send(getStateDetails(stateResult));
});

//Post a district
app.post("/districts/", checkAuthentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const selectDistrictQuery = `SELECT * FROM district WHERE district_name = '${districtName}'`;
  const dbDistrict = await db.get(selectDistrictQuery);

  if (dbDistrict !== undefined) {
    response.status(400);
    response.send("District already exits");
  } else {
    postDistrictQuery = `
      INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
      VALUES(
          '${districtName}',
          ${stateId},
          ${cases},
          ${cured},
          ${active},
          ${deaths}
                );`;
    result = await db.run(postDistrictQuery);
    response.send("District Successfully Added");
  }
});

//get district

app.get(
  "/districts/:districtId",
  checkAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT *
    FROM district
    WHERE
    district_id= ${districtId};`;
    const DistrictResult = await db.get(getDistrictQuery);
    response.send(getDistrictDetails(DistrictResult));
  }
);
//delete district

app.delete(
  "/districts/:districtId/",
  checkAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    query = `
    DELETE FROM district
    WHERE 
    district_id=${districtId};`;
    await db.run(query);
    response.send("District Removed");
  }
);

//Update District details

app.put(
  "/districts/:districtId/",
  checkAuthentication,
  async (request, response) => {
    const { districtId } = request.params;

    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const selectDistrictQuery = `SELECT * FROM district WHERE district_name = '${districtName}'`;
    const dbDistrict = await db.get(selectDistrictQuery);

    if (dbDistrict === undefined) {
      response.status(400);
      response.send("District not exits");
    } else {
      postDistrictQuery = `
      UPDATE  district
      SET 
          district_name='${districtName}',
          state_id=${stateId},
         cases= ${cases},
          cured=${cured},
          active=${active},
          deaths=${deaths}
        WHERE 
            district_id=${districtId};`;
      result = await db.run(postDistrictQuery);
      response.send("District Details Updated");
    }
  }
);

//Get statistics of state

app.get(
  "/states/:stateId/stats/",
  checkAuthentication,
  async (request, response) => {
    const { stateId } = request.params;
    query = ` SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const result = await db.get(query);
    response.send({
      totalCases: result["SUM(cases)"],
      totalCured: result["SUM(cured)"],
      totalActive: result["SUM(active)"],
      totalDeaths: result["SUM(deaths)"],
    });
  }
);

//ccbp submit NJSCPIKNGV
module.exports = app;
