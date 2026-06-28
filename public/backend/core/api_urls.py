from django.urls import path
from . import api_views

urlpatterns = [
    # Profiles
    path('student/profile/',          api_views.student_profile_me,         name='api_student_profile'),
    path('student/mentor/',           api_views.student_my_mentor,          name='api_student_my_mentor'),
    path('mentor/profile/',           api_views.mentor_profile_me,          name='api_mentor_profile'),
    path('mentor/pending/',           api_views.mentor_pending_feed,        name='api_mentor_pending'),
    path('mentor/students/',          api_views.mentor_students,            name='api_mentor_students'),
    path('mentor/students/<int:student_id>/', api_views.mentor_student_detail, name='api_mentor_student_detail'),
    path('mentor/analytics/',         api_views.mentor_analytics,           name='api_mentor_analytics'),
    path('mentor/analytics/trend/',   api_views.mentor_analytics_trend,     name='api_mentor_analytics_trend'),
    path('mentor/review-queue/',      api_views.mentor_review_queue,        name='api_mentor_review_queue'),
    path('mentor/upcoming-deadlines/', api_views.mentor_upcoming_deadlines,  name='api_mentor_upcoming_deadlines'),

    # Assignments
    path('assignments/',              api_views.assignment_list,            name='api_assignment_list'),
    path('assignments/<int:pk>/',     api_views.assignment_detail,          name='api_assignment_detail'),

    # Student task submissions
    path('my-task-submissions/',      api_views.student_task_submissions,   name='api_student_task_submissions'),

    # Messages
    path('messages/',                      api_views.message_thread,         name='api_message_thread'),
    path('messages/send/',                 api_views.message_send,           name='api_message_send'),
    path('messages/inbox/',                api_views.message_inbox,          name='api_message_inbox'),
    path('messages/conversations/',        api_views.message_conversations,  name='api_message_conversations'),
    path('messages/thread/<int:user_id>/', api_views.message_clear_thread,   name='api_message_clear_thread'),

    # Marketplace
    path('marketplace/',                   api_views.marketplace_users,      name='api_marketplace'),

    # Workspaces
    path('workspaces/',                                api_views.workspace_list,              name='api_workspace_list'),
    path('workspaces/join-invite/',                    api_views.workspace_join_invite,       name='api_workspace_join_invite'),
    path('workspaces/by-slug/<slug:slug>/',            api_views.workspace_by_slug,           name='api_workspace_by_slug'),
    path('workspaces/<int:pk>/',                       api_views.workspace_detail,            name='api_workspace_detail'),
    path('workspaces/<int:pk>/join/',                  api_views.workspace_join,              name='api_workspace_join'),
    path('workspaces/<int:pk>/join/cancel/',           api_views.workspace_join_cancel,       name='api_workspace_join_cancel'),
    path('workspaces/<int:pk>/leave/',                 api_views.workspace_leave,             name='api_workspace_leave'),
    path('workspaces/<int:pk>/members/',               api_views.workspace_members,           name='api_workspace_members'),
    path('workspaces/<int:pk>/members/bulk/',          api_views.workspace_members_bulk,      name='api_workspace_members_bulk'),
    path('workspaces/<int:pk>/members/<int:mid>/',     api_views.workspace_membership_action, name='api_workspace_membership_action'),
    path('workspaces/<int:pk>/search-users/',          api_views.workspace_search_users,      name='api_workspace_search_users'),
    path('workspaces/<int:pk>/members/direct-invite/', api_views.workspace_direct_invite,     name='api_workspace_direct_invite'),
    path('workspaces/<int:pk>/accept-invite/',         api_views.workspace_accept_invite,     name='api_workspace_accept_invite'),
    # Mentor endpoints
    path('workspaces/<int:pk>/search-mentors/',            api_views.workspace_search_mentors,        name='api_workspace_search_mentors'),
    path('workspaces/<int:pk>/mentors/',                   api_views.workspace_list_mentors,          name='api_workspace_list_mentors'),
    path('workspaces/<int:pk>/mentors/invite/',            api_views.workspace_invite_mentor,         name='api_workspace_invite_mentor'),
    path('workspaces/<int:pk>/mentors/accept/',            api_views.workspace_accept_mentor,         name='api_workspace_accept_mentor'),
    path('workspaces/<int:pk>/mentors/<int:gid>/',         api_views.workspace_remove_mentor,         name='api_workspace_remove_mentor'),
    path('workspaces/<int:pk>/resources/',             api_views.workspace_resources,         name='api_workspace_resources'),
    path('workspaces/<int:pk>/resources/<int:rid>/',   api_views.workspace_resource_delete,   name='api_workspace_resource_delete'),
    # Workspace tasks (new system)
    path('workspaces/<int:pk>/tasks/',                                              api_views.ws_tasks_list,                        name='api_ws_tasks_list'),
    path('workspaces/<int:pk>/tasks/<int:tid>/',                                    api_views.ws_task_detail,                       name='api_ws_task_detail'),
    path('workspaces/<int:pk>/tasks/<int:tid>/publish/',                            api_views.ws_task_publish,                      name='api_ws_task_publish'),
    path('workspaces/<int:pk>/tasks/<int:tid>/assign/',                             api_views.ws_task_assign,                       name='api_ws_task_assign'),
    path('workspaces/<int:pk>/tasks/<int:tid>/save-as-template/',                   api_views.ws_task_save_as_template,             name='api_ws_task_save_as_template'),
    path('workspaces/<int:pk>/tasks/<int:tid>/from-template/',                      api_views.ws_task_from_template,                name='api_ws_task_from_template'),
    path('workspaces/<int:pk>/tasks/<int:tid>/duplicate/',                          api_views.ws_task_duplicate,                    name='api_ws_task_duplicate'),
    path('workspaces/<int:pk>/task-templates/',                                     api_views.ws_task_templates_list,               name='api_ws_task_templates_list'),
    path('workspaces/<int:pk>/task-templates/<int:tid>/',                           api_views.ws_task_template_delete,              name='api_ws_task_template_delete'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/',                        api_views.ws_task_submissions,                  name='api_ws_task_submissions'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/bulk-review/',            api_views.ws_task_submissions_bulk_review,      name='api_ws_task_submissions_bulk_review'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/',              api_views.ws_task_submission_detail,            name='api_ws_task_submission_detail'),
    path('workspaces/<int:pk>/tasks/<int:tid>/my-submission/',                      api_views.ws_task_my_submission,                name='api_ws_task_my_submission'),
    path('workspaces/<int:pk>/tasks/<int:tid>/my-submission/submit/',               api_views.ws_task_my_submit,                    name='api_ws_task_my_submit'),
    path('workspaces/<int:pk>/tasks/<int:tid>/my-submission/resubmit/',             api_views.ws_task_my_resubmit,                  name='api_ws_task_my_resubmit'),
    path('workspaces/<int:pk>/tasks/<int:tid>/my-submission/recall/',               api_views.ws_task_my_recall,                    name='api_ws_task_my_recall'),
    path('workspaces/<int:pk>/tasks/<int:tid>/my-submission/start/',                api_views.ws_task_start,                        name='api_ws_task_start'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/reopen/',       api_views.ws_task_submission_reopen,            name='api_ws_task_submission_reopen'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/undo-review/',  api_views.ws_task_submission_undo_review,       name='api_ws_task_submission_undo_review'),
    path('workspaces/<int:pk>/tasks/<int:tid>/my-submission/checks/<int:did>/',     api_views.ws_task_deliverable_check,            name='api_ws_task_deliverable_check'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/comments/',     api_views.ws_task_submission_comments,          name='api_ws_task_submission_comments'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/documents/',    api_views.ws_task_submission_documents,         name='api_ws_task_submission_documents'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/documents/<int:docid>/', api_views.ws_task_submission_document_delete, name='api_ws_task_submission_document_delete'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/notes/',        api_views.ws_task_submission_notes,             name='api_ws_task_submission_notes'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/notes/<int:nid>/', api_views.ws_task_submission_note_detail,    name='api_ws_task_submission_note_detail'),
    path('workspaces/<int:pk>/tasks/<int:tid>/report/',                             api_views.ws_task_report,                       name='api_ws_task_report'),
    path('workspaces/<int:pk>/tasks/<int:tid>/report/export/',                      api_views.ws_task_report_export,                name='api_ws_task_report_export'),
    # Sections (Feature 12)
    path('workspaces/<int:pk>/sections/',               api_views.ws_task_sections,       name='api_ws_task_sections'),
    path('workspaces/<int:pk>/sections/<int:sid>/',     api_views.ws_task_section_detail, name='api_ws_task_section_detail'),
    # Rubric scores (Feature 13)
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/rubric/', api_views.ws_task_rubric_scores, name='api_ws_task_rubric_scores'),
    # Gradebook (Feature 14)
    path('workspaces/<int:pk>/gradebook/',              api_views.ws_gradebook,           name='api_ws_gradebook'),
    # Peer Review (Feature 16)
    path('workspaces/<int:pk>/tasks/<int:tid>/peer-review/trigger/',            api_views.ws_task_peer_review_trigger,  name='api_ws_peer_review_trigger'),
    path('workspaces/<int:pk>/tasks/<int:tid>/peer-reviews/<int:prid>/submit/', api_views.ws_task_peer_review_submit,   name='api_ws_peer_review_submit'),
    path('workspaces/<int:pk>/tasks/<int:tid>/my-peer-reviews/',                api_views.ws_task_my_peer_reviews,      name='api_ws_my_peer_reviews'),
    # Late override (Feature 17)
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/late-override/', api_views.ws_task_submission_late_override, name='api_ws_late_override'),
    # Inline document comments (Feature 18)
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/documents/<int:docid>/comments/',           api_views.ws_task_doc_inline_comments,       name='api_ws_doc_inline_comments'),
    path('workspaces/<int:pk>/tasks/<int:tid>/submissions/<int:sid>/documents/<int:docid>/comments/<int:cid>/', api_views.ws_task_doc_inline_comment_detail, name='api_ws_doc_inline_comment_detail'),
    # Mention autocomplete (Feature 19)
    path('workspaces/<int:pk>/mention-autocomplete/',   api_views.ws_task_mention_autocomplete, name='api_ws_mention_autocomplete'),
    path('workspaces/<int:pk>/events/',                api_views.workspace_events,            name='api_workspace_events'),
    path('workspaces/<int:pk>/events/<int:eid>/',      api_views.workspace_event_detail,      name='api_workspace_event_detail'),
    path('workspaces/<int:pk>/feed/',                  api_views.workspace_feed_list,         name='api_workspace_feed_list'),
    path('workspaces/<int:pk>/feed/<int:post_pk>/',    api_views.workspace_feed_detail,       name='api_workspace_feed_detail'),
    # Notifications
    path('notifications/',            api_views.notifications_list,         name='api_notifications'),
    path('notifications/read/',       api_views.notifications_mark_read,    name='api_notifications_read'),
    path('notifications/clear/',      api_views.notifications_clear,        name='api_notifications_clear'),
    path('notifications/<int:pk>/',   api_views.notification_delete,        name='api_notification_delete'),

    # Contact Requests
    path('contact-requests/',         api_views.contact_requests,           name='api_contact_requests'),
    path('contact-requests/<int:pk>/', api_views.contact_request_detail,    name='api_contact_request_detail'),

    # Blocks
    path('blocks/',              api_views.blocks,       name='api_blocks'),
    path('blocks/<int:pk>/',     api_views.block_detail, name='api_block_detail'),

    # Feed
    path('feed/',                                   api_views.feed_list,           name='api_feed_list'),
    path('feed/<int:pk>/',                          api_views.feed_detail,         name='api_feed_detail'),
    path('feed/<int:pk>/react/',                    api_views.post_react,          name='api_post_react'),
    path('feed/<int:pk>/comments/',                 api_views.post_comments_list,  name='api_post_comments'),
    path('feed/<int:pk>/comments/<int:cid>/',       api_views.post_comment_detail, name='api_post_comment_detail'),
    path('feed/<int:pk>/pin/',                      api_views.post_pin,            name='api_post_pin'),
    path('feed/<int:pk>/hide/',                     api_views.post_hide,           name='api_post_hide'),

    # Sessions / Availability
    path('sessions/slots/',              api_views.availability_slots,        name='api_availability_slots'),
    path('sessions/slots/<int:pk>/',     api_views.availability_slot_detail,  name='api_availability_slot_detail'),
    path('sessions/',                    api_views.sessions_list,             name='api_sessions_list'),
    path('sessions/<int:pk>/',           api_views.session_detail,            name='api_session_detail'),

    # Ratings
    path('ratings/<int:mentor_id>/',       api_views.mentor_ratings, name='api_mentor_ratings'),
    path('ratings/<int:mentor_id>/rate/',  api_views.mentor_rate,    name='api_mentor_rate'),

    # Bookmarks
    path('bookmarks/',                     api_views.bookmark_list,     name='api_bookmark_list'),
    path('feed/<int:pk>/bookmark/',        api_views.post_bookmark,     name='api_post_bookmark'),
    path('feed/activity/',                 api_views.feed_activity,     name='api_feed_activity'),

    # Profile views
    path('profile-views/me/',              api_views.my_profile_views,  name='api_my_profile_views'),
    path('profile-views/<int:user_id>/',   api_views.record_profile_view, name='api_record_profile_view'),

    # Public profile (connected users / mentor-student)
    path('profiles/<int:user_id>/',        api_views.public_profile,    name='api_public_profile'),

    # Global search
    path('search/',                        api_views.global_search,     name='api_global_search'),

    # Workspace chat (legacy single group chat)
    path('workspaces/<int:pk>/chat/',      api_views.workspace_chat,    name='api_workspace_chat'),

    # Workspace channels
    path('workspaces/<int:pk>/channels/',                                        api_views.workspace_channels,                name='api_workspace_channels'),
    path('workspaces/<int:pk>/channels/<int:cid>/',                              api_views.workspace_channel_detail,          name='api_workspace_channel_detail'),
    path('workspaces/<int:pk>/channels/<int:cid>/messages/',                     api_views.workspace_channel_messages,        name='api_workspace_channel_messages'),
    path('workspaces/<int:pk>/channels/<int:cid>/messages/<int:mid>/',           api_views.workspace_channel_message_detail,  name='api_workspace_channel_message_detail'),
    path('workspaces/<int:pk>/channels/<int:cid>/messages/<int:mid>/react/',     api_views.workspace_channel_message_react,   name='api_workspace_channel_message_react'),

    # Workspace DMs
    path('workspaces/<int:pk>/dms/',                                             api_views.workspace_dms,                     name='api_workspace_dms'),
    path('workspaces/<int:pk>/dms/<int:user_id>/',                               api_views.workspace_dm_messages,             name='api_workspace_dm_messages'),
    path('workspaces/<int:pk>/dms/<int:user_id>/<int:mid>/',                     api_views.workspace_dm_message_detail,       name='api_workspace_dm_message_detail'),

    # Workspace polls
    path('workspaces/<int:pk>/polls/',                                           api_views.workspace_polls,                   name='api_workspace_polls'),
    path('workspaces/<int:pk>/polls/<int:pid>/',                                 api_views.workspace_poll_detail,             name='api_workspace_poll_detail'),
    path('workspaces/<int:pk>/polls/<int:pid>/vote/',                            api_views.workspace_poll_vote,               name='api_workspace_poll_vote'),

    # Personal tasks
    path('personal-tasks/',               api_views.personal_tasks_list,  name='api_personal_tasks_list'),
    path('personal-tasks/<int:pk>/',      api_views.personal_task_detail, name='api_personal_task_detail'),

    # Onboarding
    path('student/onboarding/complete/',                                    api_views.student_complete_onboarding,           name='api_student_onboarding_complete'),
    path('workspaces/<int:pk>/onboarding/questions/',                       api_views.workspace_onboarding_questions,        name='api_ws_onboarding_questions'),
    path('workspaces/<int:pk>/onboarding/questions/<int:qid>/',             api_views.workspace_onboarding_question_detail,  name='api_ws_onboarding_question_detail'),
    path('workspaces/<int:pk>/onboarding/my-response/',                     api_views.workspace_onboarding_my_response,      name='api_ws_onboarding_my_response'),
    path('workspaces/<int:pk>/onboarding/submissions/',                     api_views.workspace_onboarding_submissions,      name='api_ws_onboarding_submissions'),
]
