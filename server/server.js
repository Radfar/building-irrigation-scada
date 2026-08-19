const express = require("express");

const cors = require("cors");

const {
    pool,
    testDatabaseConnection
} = require("./database");


const app = express();

const PORT = 3000;


/*
 * Middleware
 */

app.use(cors());

app.use(express.json());


/*
 * Basic API test
 */

app.get("/api", (req, res) => {

    res.json({

        application:
            "Building Irrigation SCADA",

        status:
            "online",

        message:
            "SCADA API is running"

    });

});


/*
 * Get all equipment
 */

app.get("/api/equipment", async (req, res) => {

    try {

        const result = await pool.query(`

            SELECT

                id,

                tag_name,

                description,

                equipment_type,

                location,

                created_at

            FROM equipment

            ORDER BY id;

        `);

        res.json(result.rows);

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            error:
                "Failed to retrieve equipment"

        });

    }

});

/*
 * Get all SCADA tags
 */

app.get("/api/tags", async (req, res) => {

    try {

        const result = await pool.query(`

            SELECT

                t.id,

                t.tag_name,

                t.description,

                t.data_type,

                t.unit,

                e.tag_name AS equipment_tag,

                e.description AS equipment_description,

                e.equipment_type,

                e.location

            FROM tags t

            LEFT JOIN equipment e
                ON t.equipment_id = e.id

            ORDER BY t.id;

        `);


        res.json(result.rows);

    }

    catch (error) {

        console.error(
            "Failed to retrieve tags:",
            error
        );

        res.status(500).json({

            error:
                "Failed to retrieve tags"

        });

    }

});

/*
 * Start server
 */

app.listen(PORT, async () => {

    console.log(
        `SCADA API server running at http://localhost:${PORT}`
    );


    await testDatabaseConnection();

});