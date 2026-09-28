package com.barath.jobtracker.repository;

import com.barath.jobtracker.entity.ApplicationStatus;
import org.springframework.data.jpa.repository.Query;
import com.barath.jobtracker.entity.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {

    long countByStatus(ApplicationStatus status);

    @Query("""
    SELECT j FROM JobApplication j
    WHERE (:company IS NULL OR LOWER(j.company) LIKE LOWER(CONCAT('%', :company, '%')))
    AND (:role IS NULL OR LOWER(j.role) LIKE LOWER(CONCAT('%', :role, '%')))
    AND (:location IS NULL OR LOWER(j.location) LIKE LOWER(CONCAT('%', :location, '%')))
    AND (:status IS NULL OR j.status = :status)
""")
List<JobApplication> searchApplications(
        String company,
        String role,
        String location,
        ApplicationStatus status
);
    

    List<JobApplication> findByCompanyContainingIgnoreCase(String company);

    List<JobApplication> findByStatus(ApplicationStatus status);

    List<JobApplication> findByRoleContainingIgnoreCase(String role);

List<JobApplication> findByLocationContainingIgnoreCase(String location);
}