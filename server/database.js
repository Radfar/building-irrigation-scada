const { Pool } = require("pg");
require("dotenv").config();


/*
 * PostgreSQL connection pool
 *
 * Instead of opening a new database connection for
 * every request, the application maintains a pool
 * of reusable connections.
 */

const pool = new Pool({

    host: process.env.DB_HOST,

    port: process.env.DB_PORT,

    database: process.env.DB_NAME,

    user: process.env.DB_USER,

    password: process.env.DB_PASSWORD,

});


/*
 * Check the PostgreSQL connection
 */

async function testDatabaseConnection() {

    try {

        const result = await pool.query(
            "SELECT NOW() AS current_time"
        );

        console.log(
            "PostgreSQL connected successfully."
        );

        console.log(
            "Database time:",
            result.rows[0].current_time
        );

    }

    catch (error) {

        console.error(
            "PostgreSQL connection failed:"
        );

        console.error(
            error.message
        );

    }

}


/*
 * Export the pool and test function
 */

module.exports = {

    pool,

    testDatabaseConnection

};