# Walkthrough: Team Dashboard & Board Timeline

I have successfully completed Phase 0 (Team Dashboard) and Phase 1 (Board-Level Timeline) of our plan. All database migrations, API extensions, client state selectors, UI components, and i18n locales are correctly in place, and the application compiles successfully.

## 1. Shared Foundation

- **Database:** Created a knex migration (`20260912000000_add_start_date_to_card.js`) to add `start_date` to the `card` table.
- **Server Models & Controllers:** 
  - Updated the server-side `Card` model and the `create`/`update` controllers to accept and persist `startDate`.
  - Added `TIMELINE` and `TEAM_DASHBOARD` to the respective views enums on the server.
- **Client ORM:** Updated the client-side `Card` model to include `startDate`.

## 2. Phase 0: Team Dashboard

I implemented a comprehensive "Engineering Manager" dashboard to give a quick overview of all projects in one go.

- **Cross-Board Data Aggregation:** Created a new Redux-ORM selector (`selectAllCardsForCurrentUser`) that correctly traverses the ORM graph (User -> Projects -> Boards -> Cards) to fetch all active cards across all boards you have access to. This bypasses Planka's rigid "one board at a time" restriction on the client side without needing a heavy new API endpoint.
- **UI Components:**
  - **Summary Cards:** Shows top-level metrics for `Overdue`, `Due This Week`, `In Progress`, and `Completed`.
  - **Status Board:** A kanban-style 3-column view (`In Progress`, `Upcoming`, `Completed`) where you can see cards from all projects.
  - **Workload Heatmap:** A visual density map showing how many cards are active per board over the upcoming 5 weeks, making it easy to spot bottlenecks.
- **Integration:** Added the dashboard to the `Home` page (under the "Projects" view) and integrated it with the view-switcher in `HomeActions/RightSide`.

## 3. Phase 1: Board-Level Timeline

I created a Miro-like Timeline view for individual boards.

- **Timeline UI:** Built a completely new React component suite for rendering a timeline:
  - `TimelineView.jsx`: The main container with a scrollable area.
  - `TimelineHeader.jsx`: Renders the date scale (days/weeks) with a visual indicator for "Today" and shaded weekends.
  - `TimelineSwimlane.jsx`: Groups cards (currently by list).
  - `TimelineCard.jsx`: Renders the cards as horizontal bars stretching from their `startDate` to `dueDate`.
  - `TimelineControls.jsx`: Toolbar to snap to "Today" and adjust zoom levels (Days/Weeks/Months).
- **Start Date Editor:** Built `EditStartDateStep` and `StartDateChip` and integrated them into the Card Modal so users can actually set the start dates for the timeline bars.
- **Integration:** Integrated the `TimelineView` into the `FiniteContent.jsx` component so it can be toggled using the board view-switcher buttons.

## Next Steps for You

1. **Run the Database Migration:**
   ```bash
   cd server && npx knex migrate:latest
   ```
2. **Start the Dev Servers:**
   ```bash
   # In terminal 1
   cd server && npm start
   
   # In terminal 2
   cd client && npm start
   ```
3. **Verify the Features:**
   - Go to your Home page; you should see the new **Team Dashboard** icon in the top right.
   - Open a board; you should see the new **Timeline** icon in the top right.
   - Open a card; you should see the new **Start Date** option in the sidebar. Set a start date and due date, then check the timeline!

Once you're happy with how this looks and feels, we can proceed to Phase 2 (Interactive Drag & Drop on the timeline) and Phase 3 (Filtering & Polish).
