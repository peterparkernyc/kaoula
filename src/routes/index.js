const router = require("express").Router();
const User = require("../database/models/User");
const Class = require("../database/models/Class");
const Post = require("../database/models/Post");
const Thread = require("../database/models/Thread");
const Message = require("../database/models/Message");
const Homework = require("../database/models/Homework");
const { fag } = require("../../data.json");
const { generate } = require("yourid");
const siteConfig = require("../../kaoula.config");
const Moment = require("moment");

const {
    ensureAuth,
    ensureGuest,
    ensureTeacher,
    ensureAccessToClass,
    ensurePriaveClass,
    ensureAdmin,
} = require("../middleware/requireAuth");

router.get("/", ensureGuest, (req, res) => {
    res.render("index", {
        isLoggedIn: req.isAuthenticated(),
        user: req.user,
        config: siteConfig,
    });
});

// Fix routes
router.get("/profile", ensureAuth, async (req, res) => {
    res.redirect("/profile/" + req.user.uid);
});

// New class registration
router.get("/classes/new", ensureTeacher, ensureAuth, async (req, res) => {
    res.render("classes/new", {
        isLoggedIn: req.isAuthenticated(),
        user: req.user,
        users: await User.find({}),
    });
});

// Show class
router.get(
    "/classes/:id",
    ensureAccessToClass,
    ensureAuth,
    async (req, res) => {
        Class.findById({ _id: req.params.id }, async (err, classData) => {
            if (classData === null || !classData) {
                req.flash("error", "Klassen blev ikke fundet.");
                res.redirect(
                    "/classes?error=true&error_id=1&error_message=Class not found!"
                );
            } else {
                res.render("classes/show", {
                    isLoggedIn: req.isAuthenticated(),
                    user: req.user,
                    teacher: await User.findById({ _id: classData.teacher }),
                    students: await User.find({
                        _id: { $in: classData.students },
                    }),
                    classData: classData,
                    posts: await Post.find({ class: classData._id }).sort({
                        createdAt: -1,
                    }),
                });
            }
        });
    }
);

// Show homework
router.get(
    "/classes/:id/homework",
    ensureAccessToClass,
    ensureAuth,
    async (req, res) => {
        Class.findById({ _id: req.params.id }, async (err, classData) => {
            if (classData === null || !classData) {
                res.redirect(
                    "/classes?error=true&error_id=1&error_message=Class not found!"
                );
            } else {
                res.render("classes/homework", {
                    isLoggedIn: req.isAuthenticated(),
                    user: req.user,
                    teacher: await User.findById({ _id: classData.teacher }),
                    students: await User.find({
                        _id: { $in: classData.students },
                    }),
                    classData: classData,
                    homework: await Homework.find({ class: classData._id }),
                    today: Moment().format("YYYY-MM-DD"),
                });

                console.log(`Date today: ${Moment().format("YYYY-MM-DD")}`);
            }
        });
    }
);

// Delete a homework
router.post(
    "/homework/:id/delete",
    ensureAuth,
    ensureTeacher,
    async (req, res) => {
        const { id } = req.params;

        const find = await Homework.findById(id);

        if (find === null || !find) {
            res.redirect("/classes?error=Homework not found");
        } else if (find.teacher !== req.user.id) {
            res.redirect(
                "/classes?error=Your Dont Have Permisions to delete this homework"
            );
        } else {
            await Homework.findByIdAndDelete(find.id);
            res.redirect("/classes?msg=Homework deleted");
        }
    }
);
// Edit
router.get("/homework/:id/edit", ensureAuth, async (req, res) => {
    const Work = await Homework.findById({ _id: req.params.id });

    if (req.user.id !== Work.teacher) {
        res.redirect("/");
    } else if (!Work) {
        res.redirect("/");
    } else {
        res.render("classes/editHomework", {
            isLoggedIn: req.isAuthenticated(),
            user: req.user,
            work: Work,
        });
    }
});

// Render settings page
router.get(
    "/classes/:id/settings",
    ensureTeacher,
    ensureAuth,
    async (req, res) => {
        Class.findById({ _id: req.params.id }, async (err, classData) => {
            if (classData === null || !classData) {
                res.redirect(
                    "/classes?error=true&error_id=1&error_message=Class not found!"
                );
            } else {
                res.render("classes/settings", {
                    isLoggedIn: req.isAuthenticated(),
                    user: req.user,
                    teacher: await User.findById({ _id: classData.teacher }),
                    students: await User.find({
                        _id: { $in: classData.students },
                    }),
                    users: await User.find({}),
                    fag: fag,
                    classData: classData,
                    host: process.env.HOST,
                    actions: {
                        edit: req.query.action === "EDIT",
                        manage_students: req.query.action === "MANAGE_STUDENTS",
                        new_student: req.query.action === "NEW_STUDENT",
                        delete_class: req.query.action === "DELETE_CLASS",
                        homework: req.query.action === "HOMEWORK",
                        no_action_selcted: !req.query.action,
                    },
                });
            }
        });
    }
);

// Invite Join
router.get("/invite/:id", ensureAuth, async (req, res) => {
    const { id } = req.params;

    const invite = await Class.findOne({ invite: id });

    if (!invite || invite == null) {
        res.redirect("/?error=Invite is invalid");
    } else {
        res.redirect(`/classes/${invite._id}/join`);
    }
});

// Delete class
router.post(
    "/classes/:id/delete",
    ensureTeacher,
    ensureAuth,
    async (req, res) => {
        Class.findByIdAndDelete(
            { _id: req.params.id },
            async (err, classData) => {
                if (classData === null || !classData) {
                    res.redirect(
                        "/classes?error=true&error_id=1&error_message=Class not found!"
                    );
                } else {
                    res.redirect(
                        "/classes?success=true&success_id=1&success_message=Class deleted successfully!"
                    );
                }
            }
        );
    }
);

// Join new class
router.get(
    "/classes/:id/join",
    ensurePriaveClass,
    ensureAuth,
    async (req, res) => {
        Class.findByIdAndUpdate(
            { _id: req.params.id },
            { $push: { students: [req.user._id] } },
            { new: true },
            (err, classData) => {
                if (err) {
                    res.redirect(
                        "/classes?error=true&error_id=3&error_message=Error joining class"
                    );
                } else {
                    res.redirect(
                        "/classes/" +
                            classData._id +
                            "?success=true&success_message=You have successfully joined the class"
                    );
                }
            }
        );
    }
);

// Remove student from class
router.post(
    "/classes/:id/removeMember",
    ensureTeacher,
    ensureAuth,
    async (req, res) => {
        Class.findByIdAndUpdate(
            { _id: req.params.id },
            { $pull: { students: req.body.uid } },
            { new: true },
            (err, classData) => {
                if (err) {
                    res.redirect(
                        "/classes?error=true&error_id=3&error_message=Error removing student"
                    );
                } else {
                    res.redirect(
                        "/classes/" +
                            classData._id +
                            "?success=true&success_message=Student removed from class"
                    );
                }
            }
        );
    }
);

// New class
router.post("/classes/new", ensureTeacher, ensureAuth, async (req, res) => {
    let { name, description, image, students, private, maxStudents } = req.body;

    if (private == undefined) {
        private = "off";
    }

    if (maxStudents == undefined) {
        maxStudents = "30";
    }

    if (!maxStudents) {
        maxStudents = "30";
    }

    const newClass = new Class({
        name,
        description,
        image,
        teacher: req.user._id,
        students: [req.user._id],
        private,
        maxStudents,
    });

    await newClass.save();

    res.redirect(`/classes/${newClass._id}`);
});

// New class post
router.post("/classes/new/post", ensureAuth, async (req, res, next) => {
    const { title, content, classid } = req.body;

    const newPost = new Post({
        title,
        content,
        user: [req.user.name, req.user._id, req.user.avatar, req.user.uid],
        class: classid,
    });

    await newPost.save();
    res.redirect(`/classes/${classid}?post=${newPost._id}`);
});

// New Homework
router.post(
    "/classes/new/homework",
    ensureTeacher,
    ensureAuth,
    async (req, res, next) => {
        const { title, description, subject, dueDate, classId } = req.body;

        const newHomework = new Homework({
            title,
            description,
            subject,
            teacher: req.user._id,
            class: classId,
            dueDate,
        });

        await newHomework.save();
        res.redirect(
            `/classes/${classId}?homework=${newHomework._id}&psg=setTrueToFalse`
        );
    }
);

// Update a class
router.post(
    "/classes/new/update",
    ensureTeacher,
    ensureAuth,
    async (req, res, next) => {
        let { name, description, maxStudents, private } = req.body;

        if (private == undefined) {
            private = "off";
        }

        if (maxStudents == undefined) {
            maxStudents = "30";
        }

        if (!maxStudents) {
            maxStudents = "30";
        }

        try {
            Class.findByIdAndUpdate(
                { _id: req.body.classId },
                {
                    name,
                    description,
                    maxStudents,
                    private,
                },

                { new: true },
                (err, classData) => {
                    if (err) {
                        res.redirect(
                            "/classes?error=true&error_id=3&error_message=Error updating class"
                        );
                    } else {
                        res.redirect(
                            "/classes/" +
                                classData._id +
                                "?success=true&success_message=You have successfully updated the class"
                        );
                    }
                }
            );

            console.log(req.body.private);
        } catch (error) {
            res.send({
                error: true,
                error_id: 3,
                error_message: error.message,
            });

            next();
        }
    }
);

// Update classes students
router.post(
    "/classes/new/update/invite",
    ensureTeacher,
    ensureAuth,
    async (req, res) => {
        let { uid } = req.body;

        let userId = await User.findOne({ uid: uid });

        if (userId) {
            Class.findByIdAndUpdate(
                { _id: req.body.class_id },
                { $push: { students: userId._id } },
                { new: true },
                (err, classData) => {
                    if (err) {
                        req.flash("error", "Fejl ved at inviter eleven");
                        res.redirect(
                            "/classes?error=true&error_id=3&error_message=Error inviting student&psg=" +
                                err.message
                        );
                    } else {
                        res.redirect(
                            "/classes/" +
                                classData._id +
                                "?success=true&success_message=Student invited successfully"
                        );
                    }
                }
            );
        }
    }
);

// Update classes students
router.post(
    "/classes/new/update/invite",
    ensureTeacher,
    ensureAuth,
    async (req, res) => {
        let { uid } = req.body;

        let userId = await User.findOne({ uid: uid });

        if (userId) {
            Class.findByIdAndUpdate(
                { _id: req.body.class_id },
                { $push: { students: userId._id } },
                { new: true },
                (err, classData) => {
                    if (err) {
                        req.flash("error", "Fejl ved at inviter eleven");
                        res.redirect(
                            "/classes?error=true&error_id=3&error_message=Error inviting student&psg=" +
                                err.message
                        );
                    } else {
                        res.redirect(
                            "/classes/" +
                                classData._id +
                                "?success=true&success_message=Student invited successfully"
                        );
                    }
                }
            );
        }
    }
);

// Regenarate an invite
router.post(
    "/classes/new/update/invite/new",
    ensureTeacher,
    ensureAuth,
    async (req, res, next) => {
        const { classId } = req.body;

        const classData = await Class.findById(classId);

        try {
            if (!classData || classData === null || classData === undefined) {
                res.redirect("/classes?error=class was not found");
            } else {
                classData.invite = generate({
                    length: 10,
                });

                classData.save();
                res.redirect(
                    `/classes/${classData._id}/settings?action=NEW_STUDENT&message=an new invite was created`
                );
            }
        } catch (error) {
            return next();
        }
    }
);

router.get("/classes", ensureAuth, async (req, res) => {
    res.render("classes/index", {
        isLoggedIn: req.isAuthenticated(),
        user: req.user,
        success: req.flash("success"),
        error: req.flash("error"),
        teacherClasses: await Class.find({ teacher: req.user._id }),
        studentClasses: await Class.find({ students: req.user.id }),
    });
});

// Profile Routes
router.get("/profile/:id", ensureAuth, async (req, res) => {
    const user = await User.findOne({ uid: req.params.id });

    if (!user) {
        res.redirect("/");
    } else {
        res.render("profile", {
            isLoggedIn: req.isAuthenticated(),
            user: req.user,
            profileUser: user,
            formatUserBirthdayToDanish: Moment(user.birthday)
                .locale("da")
                .format("DD/MM/YYYY"),
        });
    }
});

// Edit
router.get("/profile/:id/edit", ensureAuth, async (req, res) => {
    const user = await User.findOne({ uid: req.params.id });

    if (req.user.uid != user.uid) {
        res.redirect("/");
    } else if (!user) {
        res.redirect("/");
    } else {
        res.render("edit", {
            isLoggedIn: req.isAuthenticated(),
            user: req.user,
            profileUser: user,
        });
    }
});
// Update
router.post("/profile/:id/update", ensureAuth, async (req, res) => {
    const { name, email, phone, birthday } = req.body;

    const user = await User.findOne({ uid: req.params.id });

    if (req.user.uid != user.uid) {
        res.redirect("/");
    } else if (!user) {
        res.redirect("/");
    } else {
        user.name = name;
        user.email = email;
        user.phone = phone;
        user.birthday = birthday;
        await user.save();
        res.redirect("/profile/" + user.uid);
    }
}),
    // Messages
    // Render new message form
    router.get("/messages/new", ensureAuth, async (req, res) => {
        res.render("messages/new", {
            isLoggedIn: req.isAuthenticated(),
            user: req.user,
            users: await User.find({}),
        });
    });

// Create Message
router.post("/messages/new/thread", ensureAuth, async (req, res) => {
    const { title, subject, users } = req.body;

    const newThread = new Thread({
        tid: generate({
            length: 15,
            keyspace: "012345678910012345678910012345678910",
        }),
        title,
        subject,
        users,
    });

    await newThread.save();
    res.redirect(`/messages/t/${newThread._id}`);
}),
    // Create new Message
    router.post("/messages/new", ensureAuth, async (req, res) => {
        let { content, tid } = req.body;

        const newMessage = new Message({
            content,
            tid,
            user: [req.user.name, req.user._id, req.user.avatar, req.user.uid],
        });

        await newMessage.save();
        res.redirect(`/messages/t/${tid}`);
    });

// Render Thread
router.get("/messages/t/:id", ensureAuth, async (req, res) => {
    const thread = await Thread.findById(req.params.id);

    if (!thread) {
        res.redirect("/");
    } else if (thread.users.includes(req.user.id)) {
        res.render("messages/index", {
            isLoggedIn: req.isAuthenticated(),
            user: req.user,
            thread: thread,
            threadUser: await User.find({
                _id: { $in: thread.users },
            }),
            messages: await Message.find({ tid: req.params.id }),
        });
    } else {
        res.redirect("/");
    }
}),
    // Message List
    router.get("/messages", ensureAuth, async (req, res) => {
        res.render("messages/list", {
            isLoggedIn: req.isAuthenticated(),
            user: req.user,
            threads: await Thread.find({ users: req.user.id }),
        });
    });

// Delete Message
router.post("/messages/delete", ensureAuth, async (req, res) => {
    const msg = await Message.findById(req.body.mid);

    if (req.user.uid != msg.user[3]) {
        res.redirect("/");
    } else {
        await Message.findByIdAndDelete(req.body.mid);
        res.redirect(
            `/messages/t/${msg.tid}?success=true&success_message=Message deleted`
        );
    }
});

// Admin page
router.get("/admin", ensureAuth, ensureAdmin, async (req, res) => {
    res.render("admin/index", {
        isLoggedIn: req.isAuthenticated(),
        user: req.user,
        users: await User.find({}),
    });
});

// Delete a user
router.post(
    "/admin/user/:id/delete",
    ensureAuth,
    ensureAdmin,
    async (req, res) => {
        const { id } = req.params;

        const find = await User.findById(id);

        if (find === null || !find) {
            res.redirect("/classes?error=User was not found");
        } else if (!req.user.site_admin === true) {
            res.redirect(
                "/classes?error=Your Dont Have Permisions to delete this user"
            );
        } else {
            await User.findByIdAndDelete(find.id);
            res.redirect("/admin?msg=User was deleted");
        }
    }
);

// Make User An Teacher
router.post(
    "/admin/user/:id/teacher",
    ensureAuth,
    ensureAdmin,
    async (req, res) => {
        const { id } = req.params;

        const find = await User.findById(id);

        if (find === null || !find) {
            res.redirect("/classes?error=User was not found");
        } else if (!req.user.site_admin === true) {
            res.redirect(
                "/classes?error=Your Dont Have Permisions to delete this user"
            );
        } else {
            find.role = 5;
            find.save();

            res.redirect("/admin?msg=User is now a teacher");
        }
    }
);

// Remove user as a teacher
router.post(
    "/admin/user/:id/teacher/remove",
    ensureAuth,
    ensureAdmin,
    async (req, res) => {
        const { id } = req.params;

        const find = await User.findById(id);

        if (find === null || !find) {
            res.redirect("/classes?error=User was not found");
        } else if (!req.user.site_admin === true) {
            res.redirect(
                "/classes?error=Your Dont Have Permisions to delete this user"
            );
        } else {
            find.role = 0;
            find.save();

            res.redirect("/admin?msg=User is now a student");
        }
    }
);

// Errors
// The /classData error
router.get("/classData", (req, res) => {
    res.redirect("/classes");
});
router.get("/classData/new", (req, res) => {
    res.redirect("/classes");
});
// 404
router.get("*", (req, res) => {
    res.render("errors/404");
});

module.exports = router;
