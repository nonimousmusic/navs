# Research Connect

Product Requirements Document (PRD)

Research Attendance & Verification System (RAVS)

Version 2.0

1. Overview

Problem

Most colleges still track research attendance manually through registers or spreadsheets. Faculty have no easy way to verify work, students cannot maintain a digital work history, and administrators struggle to generate reports.

RAVS digitizes the entire research attendance process—from assigning projects to approving work sessions and generating attendance recommendations.

2. Goals

Eliminate paper-based attendance

Digitally verify research work

Maintain permanent work history

Simplify faculty approvals

Generate attendance recommendations

Generate semester reports

Manage projects and laboratories

Support thousands of students

3. Tech Stack

Frontend

Next.js 15

TypeScript

Tailwind CSS

shadcn/ui

React Hook Form

Zod

TanStack Query

Zustand

Backend

No custom backend.

Use only:

Supabase Auth

PostgreSQL

Storage

Realtime

Row Level Security

Edge Functions (optional)

Deployment

Netlify

4. User Roles

Student

Permissions

Login

View projects

View assigned faculty

Check In

Check Out

Submit work

Upload files

View approval status

View attendance

View reports

Edit profile

Faculty

Permissions

Login

View assigned students

View projects

Review submissions

Approve sessions

Reject sessions

Add remarks

Generate reports

Manage project members

Head Admin

Permissions

Everything

Manage departments

Manage laboratories

Manage users

Manage projects

Assign faculty

Assign students

View analytics

Export reports

5. Features

Authentication

Features

Email Login

College ID Login

Forgot Password

Change Password

Session Management

Remember Me

Role Detection

Protected Routes

Student Dashboard

Widgets

Active Projects

Today's Status

Current Session

Pending Approvals

Total Approved Hours

Weekly Hours

Attendance Percentage

Recent Activity

Faculty Dashboard

Widgets

Pending Reviews

Active Projects

Assigned Students

Recent Activity

Approval Statistics

Quick Actions

Admin Dashboard

Widgets

Total Students

Total Faculty

Total Departments

Total Laboratories

Active Projects

Pending Approvals

Attendance Analytics

Recent Logins

Project Management

Features

Create Project

Edit Project

Archive Project

Delete Project

Assign Faculty

Assign Students

Upload Documents

Set Project Duration

Project Timeline

Project Status

Department Management

Features

Create Department

Edit Department

Delete Department

Search

Filter

Laboratory Management

Features

Create Lab

Edit Lab

Delete Lab

Assign Faculty

Assign Projects

Student Workspace

Features

View Project Details

View Objectives

View Assigned Faculty

View Documents

Upload Work

Work Timeline

Session History

Check In System

Features

Start Session

Live Timer

Prevent Multiple Sessions

Auto Timestamp

Session Notes

Check Out System

Features

End Session

Duration Calculation

Submit Summary

Upload Files

Submit Session

Work Submission

Features

Rich Text Description

File Upload

Image Upload

PDF Upload

Multiple Attachments

Validation

Save Draft

Faculty Approval

Features

Pending Queue

Session Details

Download Attachments

Approve

Reject

Add Remarks

Approval History

Attendance Module

Features

Daily Attendance

Weekly Attendance

Monthly Attendance

Attendance Recommendation

Eligible Hours

Attendance Percentage

Reports

Generate

Attendance Report

Student Report

Faculty Report

Department Report

Laboratory Report

Project Report

Semester Report

Contribution Report

Formats

PDF

CSV

Analytics

Charts

Daily Activity

Weekly Hours

Department Statistics

Faculty Statistics

Project Completion

Attendance Trends

Notifications

Approval Received

Session Rejected

New Project Assigned

Reminder to Check Out

Project Updates

Search

Global Search

Search

Students

Faculty

Projects

Departments

Laboratories

Filters

Department

Faculty

Project

Date

Status

Semester

Profile

Features

Edit Profile

Change Password

Profile Photo

Contact Details

Settings

Theme

Notifications

Time Format

Language

Audit Logs

Track

Login

Logout

Check In

Check Out

Approval

Rejection

Project Assignment

User Creation

File Management

Supported Files

PDF

DOCX

PPT

Images

ZIP

Storage

Supabase Storage

6. Database Tables

users

profiles

departments

laboratories

faculty_assignments

projects

project_members

work_sessions

work_submissions

approvals

attendance_records

reports

notifications

audit_logs

files

7. Security

Supabase Authentication

Role-Based Access Control

Row Level Security (RLS)

Secure Storage Policies

Protected Routes

Session Validation

Input Validation

File Type Validation

8. Optional Future Features

QR Code Check-In

Geofencing

Face Verification

AI-generated Work Summaries

AI Attendance Insights

Email Notifications

Push Notifications

Google Calendar Integration

Microsoft Teams Integration

Dark Mode

Mobile App (React Native)

Offline Sync

Research Milestones

Supervisor Comments

Version History

Real-time Collaboration

Folder Structure

app/
components/
features/
hooks/
lib/
types/
utils/
public/

supabase/
├── migrations/
├── functions/
├── seed.sql

storage/

Deployment

Frontend hosted on Netlify

Authentication via Supabase Auth

Database hosted on Supabase PostgreSQL

Files stored in Supabase Storage

Authorization enforced using Row Level Security (RLS)

Optional business logic handled with Supabase Edge Functions

## Development

To run locally:

```sh
npm install
npm run dev
```
