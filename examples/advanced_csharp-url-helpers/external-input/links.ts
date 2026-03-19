import {
  createRoute,
  RequiredNumberParam,
  RequiredStringParam,
  NumberParam,
  StringParam,
  ArrayParam,
  BooleanParam,
} from "react-router-url-params";

/**
 *  This file defines all the routes in some theoretical application using react-router-url-params.
 *  It is analyzed by preparation-script.ts and produces input-data.json to
 *  generate C# URL helper methods for ASP.NET Core.
 */

export const Links = {
  Unauthorized: {
    Login: createRoute("/login", undefined, {
      redirect: StringParam,
    }),

    Register: createRoute("/register", undefined, {
      ref: StringParam,
    }),

    ConfirmEmail: createRoute("/confirm-email/:userId/:token", {
      userId: RequiredStringParam,
      token: RequiredStringParam,
    }),

    ForgotPassword: createRoute("/forgot-password"),
  },

  Authorized: {
    Dashboard: createRoute("/", undefined, {
      tab: StringParam,
    }),

    Profile: createRoute("/profile/:userId", {
      userId: RequiredNumberParam,
      section: StringParam,
    }),

    Settings: createRoute("/settings", undefined, {
      page: StringParam,
    }),

    // ------------------------
    // Courses
    // ------------------------
    Courses: createRoute("/courses", undefined, {
      page: NumberParam,
      pageSize: NumberParam,
      search: StringParam,
      tags: ArrayParam, // ?tags=a&tags=b
    }),

    CourseDetails: createRoute("/courses/:courseId", {
      courseId: RequiredNumberParam,
      tab: StringParam,
    }),

    CourseNotFound: createRoute("/courses/:courseId/not-found", {
      courseId: RequiredNumberParam,
    }),

    CourseAccessDenied: createRoute("/courses/:courseId/access-denied", {
      courseId: RequiredNumberParam,
    }),

    CourseStudents: createRoute("/courses/:courseId/students", {
      courseId: RequiredNumberParam,
      page: NumberParam,
      roles: ArrayParam,
    }),

    // ------------------------
    // Assignments
    // ------------------------
    AssignmentList: createRoute("/courses/:courseId/assignments", {
      courseId: RequiredNumberParam,
      status: StringParam,
      dueBefore: StringParam,
    }),

    AssignmentDetails: createRoute(
      "/courses/:courseId/assignments/:assignmentId",
      {
        courseId: RequiredNumberParam,
        assignmentId: RequiredNumberParam,
        tab: StringParam,
      },
    ),

    AssignmentSubmissions: createRoute(
      "/courses/:courseId/assignments/:assignmentId/submissions",
      {
        courseId: RequiredNumberParam,
        assignmentId: RequiredNumberParam,
        page: NumberParam,
        userIds: ArrayParam,
      },
    ),

    // ------------------------
    // Announcements
    // ------------------------
    Announcements: createRoute("/courses/:courseId/announcements", {
      courseId: RequiredNumberParam,
      page: NumberParam,
    }),

    AnnouncementDetails: createRoute(
      "/courses/:courseId/announcements/:announcementId",
      {
        courseId: RequiredNumberParam,
        announcementId: RequiredNumberParam,
        highlight: StringParam,
      },
    ),

    // ------------------------
    // Products
    // ------------------------
    Products: createRoute("/products", undefined, {
      page: NumberParam,
      pageSize: NumberParam,
      sortBy: StringParam,
      categories: ArrayParam,
      minPrice: NumberParam,
      maxPrice: NumberParam,
    }),

    ProductDetails: createRoute("/products/:id", {
      id: RequiredNumberParam,
    }),

    CreateProduct: createRoute("/products/create", undefined, {
      templateId: NumberParam,
    }),

    EditProduct: createRoute("/products/:id/edit", {
      id: RequiredNumberParam,
      mode: StringParam,
    }),

    // ------------------------
    // Admin
    // ------------------------
    Admin: createRoute("/admin", undefined, {
      tab: StringParam,
    }),

    AdminUsers: createRoute("/admin/users", undefined, {
      page: NumberParam,
      roles: ArrayParam,
      search: StringParam,
    }),

    AdminUserDetails: createRoute("/admin/users/:userId", {
      userId: RequiredNumberParam,
      tab: StringParam,
    }),

    // ------------------------
    // Misc
    // ------------------------
    Notifications: createRoute("/notifications", undefined, {
      unreadOnly: BooleanParam,
    }),

    Search: createRoute("/search", undefined, {
      types: ArrayParam,
      page: NumberParam,
    }),

    UiKit: createRoute("/uikit", undefined, {
      component: StringParam,
    }),
  },
};
